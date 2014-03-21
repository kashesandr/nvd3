/**
 * A HistoricalBar
 */
function HistoricalBar(options){
    options = nv.utils.valueOrDefault(options, {
        margin: {top: 0, right: 0, bottom: 0, left: 0}
        , width: 960
        , height: 500
        , chartClass: 'historicalBar'
        //, wrapClass: 'nv-bars'
    });

    var dispatchArray = ['chartClick', 'elementClick', 'elementDblClick', 'elementMouseover', 'elementMouseout'];
    Chart.call(this, options, dispatchArray);

    this.state = {};
    this.defaultState = null;

    this.id = Math.floor(Math.random() * 10000); //Create semi-unique ID in case user doesn't select one
    this.x = d3.scale.linear();
    this.y = d3.scale.linear();
    this.getX = function(d) { return d.x };
    this.getY = function(d) { return d.y };
    this.forceX = [];
    this.forceY = [0];
    this.padData = false;
    this.clipEdge = true;
    this.color = nv.utils.defaultColor();
    this.xDomain = undefined;
    this.yDomain = undefined;
    this.xRange = undefined;
    this.yRange = undefined;
    this.interactive = true;
}

/**
 * HistoricalBar extends Chart
 */
HistoricalBar.prototype = Object.create(Chart.prototype);

/**
* @override Chart::wrapChart
*/
HistoricalBar.prototype.wrapChart = function(data){

    if(this.noData(data[0].values))
        return this;

    Canvas.prototype.wrapChart.call(this, data[0].values, ['nv-bars']);

    var that = this,
        availableWidth = this.available.width,
        availableHeight = this.available.height;

    //------------------------------------------------------------
    // Setup Scales

    this.x.domain(this.xDomain || d3.extent(data[0].values.map(this.getX).concat(this.forceX) ));

    if (this.padData)
        this.x.range(this.xRange || [availableWidth * .5 / data[0].values.length, availableWidth * (data[0].values.length - .5)  / data[0].values.length ]);
    else
        this.x.range(this.xRange || [0, availableWidth]);

    this.y.domain(this.yDomain || d3.extent(data[0].values.map(this.getY).concat(this.forceY) ))
        .range(this.yRange || [availableHeight, 0]);

    // If scale's domain don't have a range, slightly adjust to make one... so a chart can show a single data point

    if (this.x.domain()[0] === this.x.domain()[1])
        this.x.domain()[0] ?
            this.x.domain([this.x.domain()[0] - this.x.domain()[0] * 0.01, this.x.domain()[1] + this.x.domain()[1] * 0.01])
            : this.x.domain([-1,1]);

    if (this.y.domain()[0] === this.y.domain()[1])
        this.y.domain()[0] ?
            this.y.domain([this.y.domain()[0] + this.y.domain()[0] * 0.01, this.y.domain()[1] - this.y.domain()[1] * 0.01])
            : this.y.domain([-1,1]);

    //------------------------------------------------------------

    this.svg.on('click', function(d,i) {
        this.dispatch.chartClick({
            data: d,
            index: i,
            pos: d3.event,
            id: that.id
        });
    });

    this.defsEnter.append('clipPath')
        .attr('id', 'nv-chart-clip-path-' + this.id)
        .append('rect');

    this.wrap.select('#nv-chart-clip-path-' + this.id + ' rect')
        .attr('width', availableWidth)
        .attr('height', availableHeight);

    this.g.attr('clip-path', this.clipEdge ? 'url(#nv-chart-clip-path-' + this.id + ')' : '');

    var bars = this.wrap.select('.nv-bars')
        .selectAll('.nv-bar')
        .data(function(d) { return d }, function(d,i) {return that.getX(d,i)});

    bars.exit().remove();

    var barsEnter = bars.enter().append('rect')
        //.attr('class', function(d,i,j) { return (getY(d,i) < 0 ? 'nv-bar negative' : 'nv-bar positive') + ' nv-bar-' + j + '-' + i })
        .attr('x', 0 )
        .attr('y', function(d,i) {  return nv.utils.NaNtoZero(that.y(Math.max(0,that.getY(d,i))))} )
        .attr('height', function(d,i) { return nv.utils.NaNtoZero(Math.abs(that.y(that.getY(d,i)) - that.y(0)))} )
        .attr('transform', function(d,i) { return 'translate(' + (that.x(that.getX(d,i)) - availableWidth / data[0].values.length * .45) + ',0)';})
        .on('mouseover', function(d,i) {
            if (!that.interactive) return;
            d3.select(this).classed('hover', true);
            that.dispatch.elementMouseover({
                point: d,
                series: data[0],
                pos: [that.x(that.getX(d,i)), that.y(that.getY(d,i))],  // TODO: Figure out why the value appears to be shifted
                pointIndex: i,
                seriesIndex: 0,
                e: d3.event
            });
        })
        .on('mouseout', function(d,i) {
            if (!that.interactive) return;
            d3.select(this).classed('hover', false);
            that.dispatch.elementMouseout({
                point: d,
                series: data[0],
                pointIndex: i,
                seriesIndex: 0,
                e: d3.event
            });
        })
        .on('click', function(d,i) {
            if (!that.interactive) return;
            that.dispatch.elementClick({
                //label: d[label],
                value: that.getY(d,i),
                data: d,
                index: i,
                pos: [that.x(that.getX(d,i)), that.y(that.getY(d,i))],
                e: d3.event,
                id: that.id
            });
            d3.event.stopPropagation();
        })
        .on('dblclick', function(d,i) {
            if (!that.interactive) return;
            that.dispatch.elementDblClick({
                //label: d[label],
                value: that.getY(d,i),
                data: d,
                index: i,
                pos: [that.x(that.getX(d,i)), that.y(that.getY(d,i))],
                e: d3.event,
                id: that.id
            });
            d3.event.stopPropagation();
        });

    bars
        .attr('fill', function(d,i) { return that.color(d, i);})
        .attr('class', function(d,i,j) { return (that.getY(d,i) < 0 ? 'nv-bar negative' : 'nv-bar positive') + ' nv-bar-' + j + '-' + i})
        .transition()
        .attr('transform', function(d,i) { return 'translate(' + (that.x(that.getX(d,i)) - availableWidth / data[0].values.length * .45) + ',0)' })
        //TODO: better width calculations that don't assume always uniform data spacing;w
        .attr('width', (availableWidth / data[0].values.length) * .9 );

    bars.transition()
        .attr('y', function(d,i) {
            var rval = that.getY(d,i) < 0 ?
                that.y(0) :
                that.y(0) - that.y(that.getY(d,i)) < 1 ?
                    that.y(0) - 1 :
                    that.y(that.getY(d,i));
            return nv.utils.NaNtoZero(rval);
        })
        .attr('height', function(d,i) { return nv.utils.NaNtoZero(Math.max(Math.abs(that.y(that.getY(d,i)) - that.y(0)),1)) });
};

HistoricalBar.prototype.x = function(_) {
    if (!arguments.length) return this.getX;
    this.getX = _;
    return this;
};

HistoricalBar.prototype.y = function(_) {
    if (!arguments.length) return this.getY;
    this.getY = _;
    return this;
};

HistoricalBar.prototype.xScale = function(_) {
    if (!arguments.length) return this.x;
    this.x = _;
    return this;
};

HistoricalBar.prototype.yScale = function(_) {
    if (!arguments.length) return this.y;
    this.y = _;
    return this;
};

HistoricalBar.prototype.xDomain = function(_) {
    if (!arguments.length) return this.xDomain;
    this.xDomain = _;
    return this;
};

HistoricalBar.prototype.yDomain = function(_) {
    if (!arguments.length) return this.yDomain;
    this.yDomain = _;
    return this;
};

HistoricalBar.prototype.xRange = function(_) {
    if (!arguments.length) return this.xRange;
    this.xRange = _;
    return this;
};

HistoricalBar.prototype.yRange = function(_) {
    if (!arguments.length) return this.yRange;
    this.yRange = _;
    return this;
};

HistoricalBar.prototype.forceX = function(_) {
    if (!arguments.length) return this.forceX;
    this.forceX = _;
    return this;
};

HistoricalBar.prototype.forceY = function(_) {
    if (!arguments.length) return this.forceY;
    this.forceY = _;
    return this;
};

HistoricalBar.prototype.padData = function(_) {
    if (!arguments.length) return this.padData;
    this.padData = _;
    return this;
};

HistoricalBar.prototype.clipEdge = function(_) {
    if (!arguments.length) return this.clipEdge;
    this.clipEdge = _;
    return this;
};

HistoricalBar.prototype.color = function(_) {
    if (!arguments.length) return this.color;
    this.color = nv.utils.getColor(_);
    return this;
};

HistoricalBar.prototype.id = function(_) {
    if (!arguments.length) return this.id;
    this.id = _;
    return this;
};

HistoricalBar.prototype.interactive = function(_) {
    if(!arguments.length) return this.interactive;
    this.interactive = _;
    return this;
};

//Create methods to allow outside functions to highlight a specific bar.
HistoricalBar.prototype.highlightPoint = function(pointIndex, isHoverOver) {
    d3.select(".nv-"+this.options.chartClass+"-" + this.id)
        .select(".nv-bars .nv-bar-0-" + pointIndex)
        .classed("hover", isHoverOver);
    return this;
};
HistoricalBar.prototype.clearHighlights = function() {
    d3.select(".nv-"+this.options.chartClass+"-" + this.id)
        .select(".nv-bars .nv-bar.hover")
        .classed("hover", false);
    return this;
};

/**
 * the historicalBar model
 * @returns {chart}
 */
nv.models.historicalBar = function() {
    "use strict";

    var historicalBar = new HistoricalBar();

    function chart(selection) {
        historicalBar.render(selection);
        return this;
    }

    chart.dispatch = historicalBar.dispatch;
    chart.options = nv.utils.optionsFunc.bind(chart);

    [
        'x',
        'y',
        'width',
        'height',
        'margin',
        'xScale',
        'yScale',
        'xDomain',
        'yDomain',
        'xRange',
        'yRange',
        'forceX',
        'forceY',
        'padData',
        'clipEdge',
        'color',
        'id',
        'interactive'
    ]
        .forEach(function(method){
            chart[method] = function(arg1){
                var ret = null;
                // Minor perf win for the 0, 1 arg versions
                // http://jsperf.com/test-call-vs-apply/34
                switch (arguments.length) {
                    case 0:
                        ret = HistoricalBar.prototype[method].call(historicalBar); break;
                    case 1:
                        ret = HistoricalBar.prototype[method].call(historicalBar, arg1); break;
                    default:
                        ret = HistoricalBar.prototype[method].apply(historicalBar, arguments)
                }
                return ret === historicalBar ? chart : ret;
            };
        });

    return chart;
};
