///<reference path="../../reference.ts" />

module Plottable {
export module Abstract {

  interface StackedDatum {
    key: any;
    value: number;
    offset?: number;
  }

  export class Stacked<X, Y> extends Abstract.NewStylePlot<X, Y> {

    private stackedExtent = [0, 0];
    public _isVertical: boolean;

    public _onDatasetUpdate() {
      super._onDatasetUpdate();
      // HACKHACK Caused since onDataSource is called before projectors are set up.  Should be fixed by #803
      if (this._datasetKeysInOrder && this._projectors["x"]  && this._projectors["y"]) {
        this.stack();
      }
    }

    private stack() {
      var datasets = this._getDatasetsInOrder();
      var keyAccessor = this._isVertical ? this._projectors["x"].accessor : this._projectors["y"].accessor;
      var valueAccessor = this._isVertical ? this._projectors["y"].accessor : this._projectors["x"].accessor;

      var dataArray: StackedDatum[][] = datasets.map((dataset) => {
        return dataset.data().map((datum) => {
          return {key: keyAccessor(datum), value: valueAccessor(datum)};
        });
      });

      var keysArray: D3.Set<any>[] = dataArray.map((data) => d3.set(data.map((datum) => datum.key)));

      var domainKeys = d3.set();
      keysArray.forEach((keys) => domainKeys = _Util.Methods.union(domainKeys, keys));

      keysArray.forEach((keys, i) => {
        domainKeys.forEach((domainKey) => {
          if (!keys.has(domainKey)) {
            dataArray[i].push({key: domainKey, value: this._missingValue()});
          }
        });
      });

      var sortedDataArray = dataArray.map((data) => {
        return domainKeys.values().map((domainKey) => {
          return data.filter((datum) => String(datum.key) === domainKey)[0];
        });
      });

      var positiveDataArray: StackedDatum[][] = sortedDataArray.map((data) => {
        return data.map((datum) => {
          return {key: datum.key, value: Math.max(0, datum.value)};
        });
      });

      var negativeDataArray: StackedDatum[][] = sortedDataArray.map((data) => {
        return data.map((datum) => {
          return {key: datum.key, value: Math.min(datum.value, 0)};
        });
      });

      this.setDatasetStackOffsets(this._stack(positiveDataArray), this._stack(negativeDataArray));

      var maxStack = _Util.Methods.max(datasets, (dataset: Dataset) => {
        return _Util.Methods.max(dataset.data(), (datum: any) => {
          return valueAccessor(datum) + datum["_PLOTTABLE_PROTECTED_FIELD_STACK_OFFSET"];
        });
      });

      var minStack = _Util.Methods.min(datasets, (dataset: Dataset) => {
        return _Util.Methods.min(dataset.data(), (datum: any) => {
          return valueAccessor(datum) + datum["_PLOTTABLE_PROTECTED_FIELD_STACK_OFFSET"];
        });
      });

      this.stackedExtent = [Math.min(minStack, 0), Math.max(0, maxStack)];
    }

    /**
     * Feeds the data through d3's stack layout function which will calculate
     * the stack offsets and use the the function declared in .out to set the offsets on the data.
     */
    private _stack(dataArray: StackedDatum[][]): StackedDatum[][] {
      var outFunction = (d: any, y0: number, y: number) => {
        d.offset = y0;
      };

      d3.layout.stack()
               .x((d) => d.key)
               .y((d) => d.value)
               .values((d) => d)
               .out(outFunction)(dataArray);

      return dataArray;
    }

    /**
     * After the stack offsets have been determined on each separate dataset, the offsets need
     * to be determined correctly on the overall datasets
     */
    private setDatasetStackOffsets(positiveDataArray: StackedDatum[][], negativeDataArray: StackedDatum[][]) {
      var keyAccessor = this._isVertical ? this._projectors["x"].accessor : this._projectors["y"].accessor;
      var valueAccessor = this._isVertical ? this._projectors["y"].accessor : this._projectors["x"].accessor;

      this._getDatasetsInOrder().forEach((dataset, datasetIndex) => {
        var positiveData = positiveDataArray[datasetIndex];
        var negativeData = negativeDataArray[datasetIndex];

        dataset.data().forEach((datum: any, datumIndex: number) => {
          var positiveOffset = positiveData.filter((posDatum) => keyAccessor(datum) === posDatum.key)[0].offset;
          var negativeOffset = negativeData.filter((negDatum) => keyAccessor(datum) === negDatum.key)[0].offset;

          datum["_PLOTTABLE_PROTECTED_FIELD_STACK_OFFSET"] = valueAccessor(datum) > 0 ? positiveOffset : negativeOffset;
        });
      });
    }

    public _updateScaleExtents() {
      super._updateScaleExtents();
      var primaryScale: Abstract.Scale<any,number> = this._isVertical ? this._yScale : this._xScale;
      if (!primaryScale) {
        return;
      }
      if (this._isAnchored && this.stackedExtent.length > 0) {
        primaryScale._updateExtent(this._plottableID.toString(), "_PLOTTABLE_PROTECTED_FIELD_STACK_EXTENT", this.stackedExtent);
      } else {
        primaryScale._removeExtent(this._plottableID.toString(), "_PLOTTABLE_PROTECTED_FIELD_STACK_EXTENT");
      }
    }

    public _missingValue(): number {
      return 0;
    }
  }
}
}
