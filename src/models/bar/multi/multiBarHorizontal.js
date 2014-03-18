nv.models.multiBarHorizontal = function() {
  "use strict";
  //============================================================
  // Public Variables with Default Settings
  //------------------------------------------------------------

  var canvas = new Canvas({
        margin: {top: 0, right: 0, bottom: 0, left: 0}
        , width: 960
        , height: 500
        , chartClass: 'multibarHorizontal'
      })
    , id = Math.floor(Math.random() * 10000) //Create semi-unique ID in case user doesn't select one
    , x = d3.scale.ordinal()
    , y = d3.scale.linear()
    , getX = function(d) { return d.x }
    , getY = function(d) { return d.y }
    , forceY = [0] // 0 is forced by default.. this makes sense for the majority of bar graphs... user can always do chart.forceY([]) to remove
    , color = nv.utils.defaultColor()
    , barColor = null // adding the ability to set the color for each rather than the whole group
    , disabled // used in conjunction with barColor to communicate from multiBarHorizontalChart what series are disabled
    , stacked = false
    , showValues = false
    , showBarLabels = false
    , valuePadding = 60
    , valueFormat = d3.format(',.2f')
    , delay = 1200
    , xDomain
    , yDomain
    , xRange
    , yRange
    , duration
    , dispatch = d3.dispatch('chartClick', 'elementClick', 'elementDblClick', 'elementMouseover', 'elementMouseout', 'renderEnd')
    ;

  //============================================================

  //============================================================
  // Private Variables
  //------------------------------------------------------------

  var x0, y0 //used to store previous scales
    , renderWatch = nv.utils.renderWatch(dispatch, duration)
    ;

  //============================================================

  function chart(selection) {

    renderWatch.reset();

    selection.each(function(data) {

      canvas.setRoot(this);

      if (canvas.noData(data))
        return chart;

      var availableWidth = canvas.available.width,
          availableHeight = canvas.available.height;

      if (stacked)
        data = d3.layout.stack()
            .offset('zero')
            .values(function(d){ return d.values })
            .y(getY)
            (data);

      //add series index to each data point for reference
      data.forEach(function(series, i) {
        series.values.forEach(function(point) { point.series = i });
      });

      //------------------------------------------------------------
      // HACK for negative value stacking
      if (stacked)
        data[0].values.map(function(d,i) {
          var posBase = 0, negBase = 0;
          data.map(function(d) {
            var f = d.values[i];
            f.size = Math.abs(f.y);
            if ( f.y<0 ) {
              f.y1 = negBase - f.size;
              negBase = negBase - f.size;
            } else {
              f.y1 = posBase;
              posBase = posBase + f.size;
            }
          });
        });

      //------------------------------------------------------------
      // Setup Scales

      // remap and flatten the data for use in calculating the scales' domains
      var seriesData = (xDomain && yDomain) ? [] : // if we know xDomain and yDomain, no need to calculate
          data.map(function(d) {
            return d.values.map(function(d,i) {
              return { x: getX(d,i), y: getY(d,i), y0: d.y0, y1: d.y1 }
            })
          });

      x.domain(xDomain || d3.merge(seriesData).map(function(d) { return d.x }))
        .rangeBands(xRange || [0, availableHeight], .1);

      //y   .domain(yDomain || d3.extent(d3.merge(seriesData).map(function(d) { return d.y + (stacked ? d.y0 : 0) }).concat(forceY)))
      y.domain(yDomain || d3.extent(d3.merge(seriesData).map(function(d) { return stacked ? (d.y > 0 ? d.y1 + d.y : d.y1 ) : d.y }).concat(forceY)));

      if (showValues && !stacked)
        y.range(yRange || [(y.domain()[0] < 0 ? valuePadding : 0), availableWidth - (y.domain()[1] > 0 ? valuePadding : 0) ]);
      else
        y.range(yRange || [0, availableWidth]);

      x0 = x0 || x;
      y0 = y0 || d3.scale.linear().domain(y.domain()).range([y(0),y(0)]);

      //------------------------------------------------------------

      //------------------------------------------------------------
      // Setup containers and skeleton of chart

      canvas.wrapChart( data );
      canvas.gEnter.append('g').attr('class', 'nv-groups');

      //------------------------------------------------------------

      var groups = canvas.wrap.select('.nv-groups').selectAll('.nv-group')
          .data(function(d) { return d }, function(d,i) { return i });
      groups.enter().append('g')
          .style('stroke-opacity', 1e-6)
          .style('fill-opacity', 1e-6);
      groups.exit().transition()
          .style('stroke-opacity', 1e-6)
          .style('fill-opacity', 1e-6)
          .remove();
      groups
          .attr('class', function(d,i) { return 'nv-group nv-series-' + i })
          .classed('hover', function(d) { return d.hover })
          .style('fill', function(d,i){ return color(d, i) })
          .style('stroke', function(d,i){ return color(d, i) });
      groups.transition()
          .style('stroke-opacity', 1)
          .style('fill-opacity', .75);

      var bars = groups.selectAll('g.nv-bar')
          .data(function(d) { return d.values });

      bars.exit().remove();

      var barsEnter = bars
        .enter().append('g')
        .attr('transform', function(d,i,j) {
            return 'translate(' + y0(stacked ? d.y0 : 0) + ',' + (stacked ? 0 : (j * x.rangeBand() / data.length ) + x(getX(d,i))) + ')'
        });
      barsEnter.append('rect')
        .attr('width', 0)
        .attr('height', x.rangeBand() / (stacked ? 1 : data.length) );

      bars
          .on('mouseover', function(d,i) { //TODO: figure out why j works above, but not here
            d3.select(this).classed('hover', true);
            dispatch.elementMouseover({
              value: getY(d,i),
              point: d,
              series: data[d.series],
              pos: [ y(getY(d,i) + (stacked ? d.y0 : 0)), x(getX(d,i)) + (x.rangeBand() * (stacked ? data.length / 2 : d.series + .5) / data.length) ],
              pointIndex: i,
              seriesIndex: d.series,
              e: d3.event
            });
          })
          .on('mouseout', function(d,i) {
            d3.select(this).classed('hover', false);
            dispatch.elementMouseout({
              value: getY(d,i),
              point: d,
              series: data[d.series],
              pointIndex: i,
              seriesIndex: d.series,
              e: d3.event
            });
          })
          .on('click', function(d,i) {
            dispatch.elementClick({
              value: getY(d,i),
              point: d,
              series: data[d.series],
              pos: [x(getX(d,i)) + (x.rangeBand() * (stacked ? data.length / 2 : d.series + .5) / data.length), y(getY(d,i) + (stacked ? d.y0 : 0))],  // TODO: Figure out why the value appears to be shifted
              pointIndex: i,
              seriesIndex: d.series,
              e: d3.event
            });
            d3.event.stopPropagation();
          })
          .on('dblclick', function(d,i) {
            dispatch.elementDblClick({
              value: getY(d,i),
              point: d,
              series: data[d.series],
              pos: [x(getX(d,i)) + (x.rangeBand() * (stacked ? data.length / 2 : d.series + .5) / data.length), y(getY(d,i) + (stacked ? d.y0 : 0))],  // TODO: Figure out why the value appears to be shifted
              pointIndex: i,
              seriesIndex: d.series,
              e: d3.event
            });
            d3.event.stopPropagation();
          });

      barsEnter.append('text');

      if (showValues && !stacked) {
        bars.select('text')
          .attr('text-anchor', function(d,i) { return getY(d,i) < 0 ? 'end' : 'start' })
          .attr('y', x.rangeBand() / (data.length * 2))
          .attr('dy', '.32em')
          .text(function(d,i) { return valueFormat(getY(d,i)) });
        bars.transition()
          .select('text')
          .attr('x', function(d,i) { return getY(d,i) < 0 ? -4 : y(getY(d,i)) - y(0) + 4 })
      } else
        bars.selectAll('text').text('');

      if (showBarLabels && !stacked) {
        barsEnter.append('text').classed('nv-bar-label',true);
        bars.select('text.nv-bar-label')
          .attr('text-anchor', function(d,i) { return getY(d,i) < 0 ? 'start' : 'end' })
          .attr('y', x.rangeBand() / (data.length * 2))
          .attr('dy', '.32em')
          .text(function(d,i) { return getX(d,i) });
        bars.transition()
          .select('text.nv-bar-label')
          .attr('x', function(d,i) { return getY(d,i) < 0 ? y(0) - y(getY(d,i)) + 4 : -4 });
      }
      else
        bars.selectAll('text.nv-bar-label').text('');

      bars.attr('class', function(d,i) { return getY(d,i) < 0 ? 'nv-bar negative' : 'nv-bar positive'});

      if (barColor) {
        if (!disabled) disabled = data.map(function() { return true });
          var _colorBars = function(d,i,j) {
              return d3
                .rgb(barColor(d,i))
                .darker(disabled.map(function(d,i) { return i }).filter(function(d,i){ return !disabled[i] })[j] )
                .toString()
          };
        bars.style('fill', _colorBars)
          .style('stroke', _colorBars);
      }

      if (stacked)
        bars.transition()
            .attr('transform', function(d,i) { return 'translate(' + y(d.y1) + ',' + x(getX(d,i)) + ')' })
          .select('rect')
            .attr('width', function(d,i) { return Math.abs(y(getY(d,i) + d.y0) - y(d.y0)) })
            .attr('height', x.rangeBand() );
      else
        bars.transition()
          .attr('transform', function(d,i) {
            //TODO: stacked must be all positive or all negative, not both?
            return 'translate(' +
            (getY(d,i) < 0 ? y(getY(d,i)) : y(0))
            + ',' +
            (d.series * x.rangeBand() / data.length
            +
            x(getX(d,i)) )
            + ')'
          })
          .select('rect')
            .attr('height', x.rangeBand() / data.length )
            .attr('width', function(d,i) { return Math.max(Math.abs(y(getY(d,i)) - y(0)),1) });

      //store old scales for use in transitions on update
      x0 = x.copy();
      y0 = y.copy();

    });

    return chart;
  }

  //============================================================
  // Expose Public Variables
  //------------------------------------------------------------

  chart.dispatch = dispatch;

  chart.options = nv.utils.optionsFunc.bind(chart);

  chart.x = function(_) {
    if (!arguments.length) return getX;
    getX = _;
    return chart;
  };

  chart.y = function(_) {
    if (!arguments.length) return getY;
    getY = _;
    return chart;
  };

  chart.margin = function(_) {
    if (!arguments.length) return canvas.margin;
      canvas.margin.top    = nv.utils.valueOrDefault(_.top, canvas.margin.top);
      canvas.margin.right  = nv.utils.valueOrDefault(_.right, canvas.margin.right);
      canvas.margin.bottom = nv.utils.valueOrDefault(_.bottom, canvas.margin.bottom);
      canvas.margin.left   = nv.utils.valueOrDefault(_.left, canvas.margin.left);
    return chart;
  };

  chart.width = function(_) {
    if (!arguments.length) return canvas.options.size.width;
    canvas.options.size.width = _;
    return chart;
  };

  chart.height = function(_) {
    if (!arguments.length) return canvas.options.size.height;
    canvas.options.size.height = _;
    return chart;
  };

  chart.xScale = function(_) {
    if (!arguments.length) return x;
    x = _;
    return chart;
  };

  chart.yScale = function(_) {
    if (!arguments.length) return y;
    y = _;
    return chart;
  };

  chart.xDomain = function(_) {
    if (!arguments.length) return xDomain;
    xDomain = _;
    return chart;
  };

  chart.yDomain = function(_) {
    if (!arguments.length) return yDomain;
    yDomain = _;
    return chart;
  };

  chart.xRange = function(_) {
    if (!arguments.length) return xRange;
    xRange = _;
    return chart;
  };

  chart.yRange = function(_) {
    if (!arguments.length) return yRange;
    yRange = _;
    return chart;
  };

  chart.forceY = function(_) {
    if (!arguments.length) return forceY;
    forceY = _;
    return chart;
  };

  chart.stacked = function(_) {
    if (!arguments.length) return stacked;
    stacked = _;
    return chart;
  };

  chart.color = function(_) {
    if (!arguments.length) return color;
    color = nv.utils.getColor(_);
    return chart;
  };

  chart.barColor = function(_) {
    if (!arguments.length) return barColor;
    barColor = nv.utils.getColor(_);
    return chart;
  };

  chart.disabled = function(_) {
    if (!arguments.length) return disabled;
    disabled = _;
    return chart;
  };

  chart.id = function(_) {
    if (!arguments.length) return id;
    id = _;
    return chart;
  };

  chart.delay = function(_) {
    if (!arguments.length) return delay;
    delay = _;
    return chart;
  };

  chart.showValues = function(_) {
    if (!arguments.length) return showValues;
    showValues = _;
    return chart;
  };

  chart.showBarLabels = function(_) {
    if (!arguments.length) return showBarLabels;
    showBarLabels = _;
    return chart;
  };

  chart.valueFormat= function(_) {
    if (!arguments.length) return valueFormat;
    valueFormat = _;
    return chart;
  };

  chart.valuePadding = function(_) {
    if (!arguments.length) return valuePadding;
    valuePadding = _;
    return chart;
  };

  //============================================================

  return chart;
};