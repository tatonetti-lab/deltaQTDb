// deltaQT Database - Histogram, Updated March 28, 2017 
// 
// Copyright (C) 2017, Tatonetti Lab
// Tal Lorberbaum <tal.lorberbaum@columbia.edu>
// Victor Nwankwo <vtn2106@cumc.columbia.edu>
// Nicholas P. Tatonetti <nick.tatonetti@columbia.edu>
// All rights reserved.
// 
// Released under a CC BY-NC-SA 4.0 license.
// For full license details see LICENSE.txt at 
// https://github.com/tal-baum/deltaQTDb or go to:
// http://creativecommons.org/licenses/by-nc-sa/4.0/

var Faux = ReactFauxDOM;
var changeLegend = true;

function mean(numbers) {
    var total = 0,
        i;
    for (i = 0; i < numbers.length; i += 1) {
        total += numbers[i];
    }
    return total / numbers.length;
}

function countBy(collection) {
  var object = {"W": 0, "B": 0, "O": 0};

  collection.forEach(function(item) {
    if (item in object) {
      ++object[item];
    }
  });

  return object;
}

var Chart = React.createClass({
    mixins: [Faux.mixins.core, Faux.mixins.anim],
    getInitialState: function(){
        return { deltas: this.props.deltas,
                 deltas_overlay: this.props.deltas_overlay}
    },
    render: function(){
        return <div className="plots">
            {this.state.chart}
        </div>
    },
    
    componentDidMount: function(){
        // This will create a faux div and store its virtual DOM in state.chart
        var faux = this.connectFauxDOM('div', 'chart')

        var component = this

        // Chart code starts here
        var values = this.props.deltas[0];
        var values_overlay = this.props.deltas_overlay;
        
        var values_deltas = [values.min, values.max];
        
        var values_overlay_deltas = [];
        $.each(values_overlay, function(key, value){
           values_overlay_deltas.push( value.delta );
        });
        
//        debug("width",this.props.width, "height",this.props.height);
        var margin = {top: 0, right: 30, bottom: 75, left: 75},
            
            width = this.props.width - margin.left - margin.right,
            height = this.props.height - margin.top - margin.bottom;
        
        var svg = d3.select(faux)
            .append("svg")
                .attr("width", width + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom)
                .attr("id", "qtdb_fig_1"),
            
            g_densities = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")"),
            
            g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")"),

            padding = 100; // space around the chart, not including labels


        const [min, max] = d3.extent(values_deltas.concat(values_overlay_deltas));
        
        const roundedMin = Math.round(min / 10) * 10,
              roundedMax = Math.round(max / 10) * 10;
        const thresholds = d3.range(roundedMin, roundedMax, 10);
        // debug("Thresholds", roundedMin, roundedMax, thresholds);
        
        var x = d3.scaleLinear()
            .domain([roundedMin, roundedMax])
            .rangeRound([0, width])        
        
        var histogram = d3.histogram()
            .value(function(d) { return d.delta; })
            .domain(x.domain())
            .thresholds(thresholds);
        
        var bins = values.bins;
        // debug(bins);
        
        var unnorm_bins_overlay = histogram(values_overlay); // preserves bin width and location

        var bin_count_overlay;
        var bins_overlay = [];

        for (bin_count_overlay = 0; bin_count_overlay < unnorm_bins_overlay.length; bin_count_overlay++) {
            var temp_array = [];
            if (values_overlay.length != 0) {
                    temp_array['value'] = 100 * unnorm_bins_overlay[bin_count_overlay].length/values_overlay.length;
                    temp_array['numPatients'] = unnorm_bins_overlay[bin_count_overlay].length;
                } else {
                    temp_array['value'] = 0;
                    temp_array['numPatients'] = 0;
                }
            temp_array['x0'] = unnorm_bins_overlay[bin_count_overlay].x0;
            temp_array['x1'] = unnorm_bins_overlay[bin_count_overlay].x1;

            bins_overlay.push( temp_array );
        }

        var y = d3.scaleLinear()
            .domain([0, d3.max(bins.concat(bins_overlay), function(d) {
              return d.value;
            })])
            .range([height, 0]);
        
        // Store reference domain max for subsequent comparisons
        var refDomainMax = y.domain()[1];        
        
        
        // Add bars
        var bar = g.selectAll(".bar")
          .data(bins)
          .enter().append("g")
            .attr("class", "bar")
            .attr("transform", function(d) { return "translate(" + x(d.x0 + 0.333) + "," + y(d.value) + ")"; })//;
            .style("opacity",1)

        var bar_overlay = g.selectAll(".bar_overlay")
          .data(bins_overlay)
          .enter().append("g")
            .attr("class", "bar_overlay")
            .attr("transform", function(d) { return "translate(" + x(d.x0 + 0.333) + "," + y(d.value) + ")"; });

        bar_overlay.append("rect")
            .attr("class","overlay")
            .attr("x", 1)
            .attr("width", x(bins_overlay[0].x1) - x(bins_overlay[0].x0) - 3.66)
            .attr("height", function(d) { return height - y(d.value); })

        bar.append("rect")
            .attr("class","background")
            .attr("x", 1)
            .attr("width", x(bins[0].x1) - x(bins[0].x0) - 3.66)
            .attr("height", function(d) { return height - y(d.value); })

        // Add the x Axis
        var xAxis = d3.axisBottom().scale(x); //.ticks(10);
        g.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + height + ")")
            .style("font-size", "12px")
            .style("font-family","lmroman")
            .call(xAxis);

        // Add the y Axis
        var yAxis = d3.axisLeft().scale(y); //.ticks(7);
        g.append("g")
            .attr("class", "y axis")
            .style("font-size", "12px")
            .style("font-family","lmroman")
            .call(yAxis);


        // now add titles to the axes
        g.append("text")
            .attr("text-anchor", "middle")  // this makes it easy to centre the text as the transform is applied to the anchor
            .attr("transform", "translate(-"+ (padding/2) +","+(height/2)+")rotate(-90)")  // text is drawn off the screen top left, move down and out and rotate
            .text("% of patients");

        g.append("text")
            .attr("text-anchor", "middle")  // this makes it easy to centre the text as the transform is applied to the anchor
            .attr("transform", "translate("+ ((margin.left + width -20)/2) +","+(height+(padding/3) + 20)+")")  // centre below axis
            .attr("class", "xlabel")
            .text("∆QTc (milliseconds)");
        
        
        // Define line
        var x_densities = [];
        var line = d3.line()
                .x(function(d,i) { return x( x_densities[i] ); })
                .y(y)
                .curve(d3.curveMonotoneX);
        
        
        // Separate SVG for data table
        var dataTableWidth = 180;
        var svgTable = d3.select(faux).append("svg")
                        .attr("width", dataTableWidth)
                        .attr("height", height + margin.top + margin.bottom);
        
        // Data Table
        var dataTable = svgTable.append("g")
            .attr("class", "table")
            .style("opacity", 0);
        
        dataTable.append("rect")
            .attr("y", 0.6).attr("x", 0.6)
            .attr("width", dataTableWidth-12)
            .attr("height", height+1)
            .attr("rx", 4).attr("ry", 4)
            .style("stroke", "black").style("stroke-width", 1.2)
            .style("fill", 'none');

        var tableTitle       = dataTable.append("text").attr("font-size", "18px").text("All patients"),
            
            tableNumPatients = dataTable.append("text").text("").attr("dy", "2em"),
            
            tableAvgAge      = dataTable.append("text").text("").attr("dy", "3.8em"),       
            tableAvgNumDrugs = dataTable.append("text").text("").attr("dy", "5.1em"),
            
            tableQT500Title  = dataTable.append("text").text("QTc ≥ 500ms").attr("dy", "6.9em"),
            tablePreQT500    = dataTable.append("text").text("").attr("dy", "8.2em"),
            tablePostQT500   = dataTable.append("text").text("").attr("dy", "9.5em"),
            
            tableWhite = dataTable.append("text").text("").attr("dy", "11.3em"),
            tableBlack = dataTable.append("text").text("").attr("dy", "12.6em"),
            tableOther = dataTable.append("text").text("").attr("dy", "13.9em"),
            
            tableOtherLine2 = dataTable.append("text").text("(incl. Hispanic)")
                                        .attr("dy", "17.75em")
                                        .attr("font-size", "14px");
        
        dataTable.selectAll("text").attr("y", 20).attr("x", 6);
        ///////
        
        
        ////////////////////////////////////////////////////////////
        this.resize = ()=> {
            var transitionDuration = 500; //300;
            var fauxDuration = 2000;
            
            // debug("in resize()", this.props.width);
            var new_svg_width = this.props.width;
            var new_width = new_svg_width - margin.left - margin.right;
            // debug("new_width", new_svg_width);
            
            // Resize svg and set new x scale
            svg.attr("width", new_width + margin.left + margin.right);
            x.rangeRound([0, new_width]);
            
            // Move x-label
            g.selectAll(".xlabel").attr("transform", "translate("+ ((margin.left + new_width -20)/2) +","+(height+(padding/3) + 20)+")")  // centre below axis
            
            // Update histogram bar widths and translations
            bar.transition().duration(transitionDuration)
             .attr("transform", function(d) { return "translate(" + x(d.x0 + 0.333) + "," + y(d.value) + ")"; }).select("rect").attr("width", x(bins[0].x1) - x(bins[0].x0) - 3.66);
            
            bar_overlay.transition().duration(transitionDuration)
             .attr("transform", function(d) { return "translate(" + x(d.x0 + 0.333) + "," + y(d.value) + ")"; }).select("rect").attr("width", x(bins[0].x1) - x(bins[0].x0) - 3.66);
            
            // Update line locations
            g_densities.selectAll(".line").transition()
                    .attr("d", line);
            
            // Update the y axis
            g.select(".y.axis")
             .transition().duration(transitionDuration)
             .style("font-size", this.props.width == 625 ? "12px": "10px")
             .call(yAxis);

            // Update the x axis
            g.select(".x.axis")
              .transition().duration(transitionDuration)
              .style("font-size", this.props.width == 625 ? "12px": "10px")
              .call(xAxis);
            
            // Update the legend position and font size
            var legendXPos = this.props.width == 625 ? 70: 40;
            var legendFontSize = this.props.width == 625 ? "16px": "12px";
            g.selectAll(".legend")
                .attr("transform", "translate(" + x(legendXPos) + "," + y(y.domain()[1]-2) + ")")
                .select("text").attr("font-size", legendFontSize);
            
            component.animateFauxDOM(fauxDuration)
            
        }
        
        ////////////////////////////////////////////////////////////
        
        this.updateData = ()=> {            
//            debug("In updateData()");
            var drugs = this.props.drugs;
//            debug("Updating for",drugs);
            
            values = this.props.deltas;
            values_overlay = this.props.deltas_overlay;
            
            var densities = [];
            
//            debug("values_overlay in update", values_overlay.length);
            
            // Apply filter for selected sexes
            var males = this.props.males == true ? 'M' : '';
            var females = this.props.females == true ? 'F' : '';
            var sexes = males+females;
            sexes = (sexes != '' ? sexes : 'MF');
//            debug('sexes chosen for chart update', sexes);           
            
            // Assign background histogram & densities arrays
            if (values.length == 1) {
                switch (sexes) {
                    case 'MF':
                        values = background_deltas_MF;
                        break;
                    case 'M':
                        values = background_deltas_M;
                        break;
                    case 'F':
                        values = background_deltas_F;
                        break;
                }
            } else {
                //debug("# of Backgrounds", values.length);
                densities = values.slice(1,values.length);
                values = values[0];
                
                //debug("densities", densities);
                //debug("values", values, "this.props.deltas", this.props.deltas);
            }
            
            if (sexes != 'MF') {
              // Overlay
//              debug("orig", values_overlay.length);
              values_overlay = JSON.parse(JSON.stringify(this.props.deltas_overlay)); // deep copy
              var i = values_overlay.length;
              while (i--) {
                  if (values_overlay[i].sex != sexes) {
                      values_overlay.splice(i, 1);
                  }
              }
//              debug("spliced", values_overlay.length);
                
              // Background
              if (densities.length != 0) {
//                  debug("orig background", densities);
//                  debug("orig props", this.props.deltas);
                  densities = JSON.parse(JSON.stringify(densities));
//                  debug("post copy", this.props.deltas);
                  
                  debug("orig background", densities);
                  for (var j = 0; j < densities.length; j++) {
                      var i = densities[j].length;
                      while (i--) {
                          if (densities[j][i].sex != sexes) {
                              densities[j].splice(i, 1);
                          }
                      }
                  }
                      
                  debug("spliced background", densities);
              }
              
            }
            ///////
            
            
            // Calculate densities bins
            var line_densities = [];
            if (densities.length != 0) {
                var unnorm_bins_densities = {};
                x_densities = [];
                
                for (var j = 0; j < densities.length; j++) {
                    unnorm_bins_densities[j] = histogram(densities[j]);
                    var temp_valuesArr = [];
                    
                    for (var bin_count = 0; bin_count < unnorm_bins_densities[j].length; bin_count++) {
                        var temp_value;
                        if (densities[j].length != 0) {
                            temp_value = 100 * unnorm_bins_densities[j][bin_count].length/densities[j].length;
                        } else {
                            temp_value = 0;
                        }
                        
                        if (j == 0) {
                            x_densities.push( (unnorm_bins_densities[j][bin_count].x0 + unnorm_bins_densities[j][bin_count].x1)/2 )
                        }

                        temp_valuesArr.push( temp_value );
                    }
                    temp_valuesArr.name = drugs[j];
                    line_densities.push(temp_valuesArr) 
                }
                // debug("x_densities", x_densities, "line_densities", line_densities);
//                debug("concat_densities", [].concat.apply([], line_densities));
//                debug("x_densities", x_densities, "line_densities", line_densities);
            }
            ///////
            
            
            // Update background
            bins = values.bins;
            ///////
            
            // Update overlay
            var unnorm_bins_overlay = histogram(values_overlay); // preserves bin width and location
            var bin_count_overlay;
            bins_overlay = [];

            for (bin_count_overlay = 0; bin_count_overlay < unnorm_bins_overlay.length; bin_count_overlay++) {
                var temp_array = [];
                if (values_overlay.length != 0) {
                    temp_array['value'] = 100 * unnorm_bins_overlay[bin_count_overlay].length/values_overlay.length;
                    temp_array['numPatients'] = unnorm_bins_overlay[bin_count_overlay].length;
                } else {
                    temp_array['value'] = 0;
                    temp_array['numPatients'] = 0;
                }
                temp_array['x0'] = unnorm_bins_overlay[bin_count_overlay].x0;
                temp_array['x1'] = unnorm_bins_overlay[bin_count_overlay].x1;

                bins_overlay.push( temp_array );
            }
//            debug("bins_overlay", unnorm_bins_overlay);
            ///////
            
            // Update y.domain: want to ensure that axis can only increase but not decrease below reference
            var putativeDomainMax = d3.max(bins.concat(bins_overlay), function(d) { return d.value; });
            if (densities.length != 0) { // also check heights of density plots
                // debug("checking densities max height. before:", putativeDomainMax);
                var flattenedDensities = [].concat.apply([], line_densities);
                putativeDomainMax = d3.max( flattenedDensities.concat(putativeDomainMax) );
                // debug("after:", putativeDomainMax);
            }
            
            if ( Math.abs(putativeDomainMax - y.domain()[1]) > 0 && putativeDomainMax >= refDomainMax ) {
                debug("current y",y.domain()[1]);
                debug("new y", putativeDomainMax);
                y.domain([0, putativeDomainMax]);
            }
            ///////
            
            var transitionDuration = 500; //300;
            var fauxDuration = 2000; //1000;
            
           // Add the y Axis
           g.select(".y.axis")
             .transition().duration(transitionDuration)
             .call(yAxis);

           // Add the x Axis
           g.select(".x.axis")
             .transition().duration(transitionDuration)
             .call(xAxis);
          ///////
            
          // Calculate average age across all new results
          var allAges = [];
          // Calculate average num_drugs across all new results
          var allNumDrugs = [];
          // Calculate race breakdown across all new results
          var allRaces = [];
          // Calculate % QTc>=500ms across all new results
          var allPreQT500 = [];
          var allPostQT500 = [];
          $.each(values_overlay, function(key, value){
                   allAges.push( value.age );
                   allNumDrugs.push( value.num_drugs ); 
                   allRaces.push( value.race );
                   allPreQT500.push( value.pre_qt_500 );
                   allPostQT500.push( value.post_qt_500 );
                });
          var allAgesAvg = Math.round(mean(allAges));
//          debug(allAges.length, allAges);
          
          var allNumDrugsAvg = Math.round(mean(allNumDrugs));
//          debug(allNumDrugs.length, allNumDrugsAvg);
          
          var allRaceCount = countBy(allRaces);
          var allWhitePercent = Math.round(100 * allRaceCount.W / values_overlay.length),
              allBlackPercent = Math.round(100 * allRaceCount.B / values_overlay.length),
              allOtherPercent = 100 - allWhitePercent - allBlackPercent; //Math.round(100 * allRaceCount.O / values_overlay.length);
//          debug(allRaces.length, allRaceCount, allRaceCount.W);
//          debug(allWhitePercent, allBlackPercent, allOtherPercent);
          
          var allPreQT500Percent = Math.round(100 * allPreQT500.reduce((total, num) => total + num, 0) / allPreQT500.length);
          var allPostQT500Percent = Math.round(100 * allPostQT500.reduce((total, num) => total + num, 0) / allPostQT500.length);
          ///////    
            
            
            // Update overlay histogram and add mouseover
            bar_overlay
             .data(bins_overlay)
             .on("mouseover", function(d,i){ //mousemove
                d3.event.stopPropagation();
//                debug(i, bins_overlay[i].x0, bins_overlay[i].x1);
                tableTitle//.transition(300)
                    .text("∆QTc: " + bins_overlay[i].x0 + " – " + bins_overlay[i].x1 + "ms")
                tableNumPatients.text(numberWithCommas(bins_overlay[i].numPatients) + " patients (" + Math.round(bins_overlay[i].value) + "%)")
                
                component.animateFauxDOM(1000) //500)
                
                var ages = [];
                var numDrugs = [];
                var races = [];
                var preQT500s = [];
                var postQT500s = [];
                $.each(unnorm_bins_overlay[i], function(key, value){
                   ages.push( value.age );
                   numDrugs.push( value.num_drugs );
                   races.push( value.race );
                   preQT500s.push( value.pre_qt_500 ); 
                   postQT500s.push( value.post_qt_500 );
                });
                
                tableAvgAge.text("Average Age: " + Math.round(mean(ages)) );
                
                tableAvgNumDrugs.text("Average # Drugs: " + Math.round(mean(numDrugs)) );
                
                var binPreQT500Percent  = Math.round(100 *  preQT500s.reduce((total, num) => total + num, 0) /  preQT500s.length);
                var binPostQT500Percent = Math.round(100 * postQT500s.reduce((total, num) => total + num, 0) / postQT500s.length);
                tablePreQT500.text("Baseline: \u00a0" + Array(1+binPostQT500Percent.toString().length-binPreQT500Percent.toString().length).join("\u00a0") + binPreQT500Percent + "%");
                tablePostQT500.text("Post-drug: " + binPostQT500Percent + "%");
                
                var binRaceCount = countBy(races);
                var binWhitePercent = Math.round(100 * binRaceCount.W / bins_overlay[i].numPatients),
                    binBlackPercent = Math.round(100 * binRaceCount.B / bins_overlay[i].numPatients),
                    binOtherPercent = 100 - binWhitePercent - binBlackPercent; //Math.round(100 * binRaceCount.O / bins_overlay[i].numPatients);
                tableWhite.text("White: " + binWhitePercent + "%");
                tableBlack.text("Black: " + (binBlackPercent < 10? "\u00a0": "") + binBlackPercent + "%");
                tableOther.text("Other: " + binOtherPercent + "%");
                //tableOther.text("Hispanic + Other: " + binOtherPercent + "%");
                
              })
            
             .on("mouseout", function(){
                tableTitle//.transition(300)
                    .text("All patients")
                tableNumPatients.text(numberWithCommas(values_overlay.length) + " patients found");
                
                tableAvgAge.text("Average Age: " + allAgesAvg);
                
                tableAvgNumDrugs.text("Average # Drugs: " + allNumDrugsAvg);
                
                tablePreQT500.text( "Baseline: \u00a0" + Array(1+allPostQT500Percent.toString().length-allPreQT500Percent.toString().length).join("\u00a0") + allPreQT500Percent + "%");
                tablePostQT500.text("Post-drug: " + allPostQT500Percent + "%");
                
                tableWhite.text("White: " + allWhitePercent + "%");
                tableBlack.text("Black: " + (allBlackPercent < 10? "\u00a0": "") + allBlackPercent + "%");
                tableOther.text("Other: " + allOtherPercent + "%");
                //tableOther.text("Hispanic + Other: " + allOtherPercent + "%");
                
                component.animateFauxDOM(fauxDuration)
              })
            
             .transition().duration(transitionDuration)
             .attr("transform", function(d) { return "translate(" + x(d.x0 + 0.333) + "," + y(d.value) + ")"; })
             .select('rect')
             .attr("height",function(d) {return height - y(d.value);})
            
            component.animateFauxDOM(fauxDuration)


            if (this.props.deltas.length > 1) {
                bar//.style("opacity",1)
                .transition(transitionDuration).style("opacity",0)
            } else {
                bar
                 .data(bins)//.style("opacity",1)
                 .transition().duration(transitionDuration)
                    .style("opacity",1)
                 .attr("transform", function(d) { return "translate(" + x(d.x0 + 0.333) + "," + y(d.value) + ")"; })
                 .select('rect')
                 .attr("height",function(d) {return height - y(d.value);})
            }
            ///////
            
            
            // Update data table
            if (values_overlay.length > 0) {
                tableTitle.text("All patients");
                tableNumPatients.text(numberWithCommas(values_overlay.length) + " patients found");
                
                tableAvgAge.text("Average Age: " + allAgesAvg);
                
                tableAvgNumDrugs.text("Average # Drugs: " + allNumDrugsAvg);
                
                tablePreQT500.text( "Baseline: \u00a0" + Array(1+allPostQT500Percent.toString().length-allPreQT500Percent.toString().length).join("\u00a0") + allPreQT500Percent + "%");
                tablePostQT500.text("Post-drug: " + allPostQT500Percent + "%");
                
                tableWhite.text("White: " + allWhitePercent + "%");
                tableBlack.text("Black: " + (allBlackPercent < 10? "\u00a0": "") + allBlackPercent + "%");
                tableOther.text("Other: " + allOtherPercent + "%");
                //tableOther.text("Hispanic + Other: " + allOtherPercent + "%");
                
                dataTable.transition().style("opacity", 100);
            } else {
                dataTable.transition().style("opacity", 0);
            }
            ///////
            
            
            // Update legend
            var colorPalette = d3.scaleOrdinal(d3.schemeSet2);
            
            if (drugs.length == 0) {
                var legendData = [];
                var legendColors = [];
            } else if (drugs.length == 1) {
                var legendData = ['Entire database', drugs[0]];
                var legendColors = ['gray', 'steelblue'];
            } else if (values_overlay.length != 0) {
                var legendData = drugs.concat('Combination');
//                debug(drugs, legendData);
                
                var legendColors = [];
                $.each(drugs, function(index, value){
                   legendColors.push( colorPalette(index) );
                });
                legendColors.push('steelblue');
            } else {
                var legendData = drugs;
//                debug(drugs, legendData);
                
                var legendColors = [];
                $.each(drugs, function(index, value){
                   legendColors.push( colorPalette(index) );
                });
            }
            
            var legend = g.selectAll(".legend").data(legendData);
            var legendXPos = this.props.width == 625 ? 70: 40;
            var legendFontSize = this.props.width == 625 ? "16px": "12px";
//            debug("legendXPos",legendXPos);
            
            legend.exit().remove();
            
            legend.transition().attr("transform", "translate(" + x(legendXPos) + "," + y(y.domain()[1]-2) + ")");
            
            var legendEnter = legend.enter().append("g")
                        .attr("class", "legend")
                        .attr("height", 100)
                        .attr("width", 100)
                        .attr("transform", "translate(" + x(legendXPos) + "," + y(y.domain()[1]-2) + ")")
            
            legendEnter.append("rect");
            legendEnter.append("text");
            
            var legendRect = g.selectAll(".legend").select("rect")
                                .attr("x", 0)
                                .attr("y", function(d, i) {return i * 20;} )
                                .attr("width", 10)
                                .attr("height", 10)
                                .attr("opacity", 0.7)
                                .style("fill", function (d, i) { return legendColors[i]; });
            
            var legendText = g.selectAll(".legend").select("text")
                                .attr("x", 15)
                                .attr("y", function (d, i) { return i * 20 + 10;})
                                .attr("font-size", legendFontSize)
                                .text(function (d) { return d;});
            ///////
            
            
            // Add density lines 
            var lines = g_densities.selectAll(".line")
                       .data(line_densities, function(d) { return d.name; })
                                  
            lines.exit().remove();
            
            lines.enter().append("path")
                      .attr("fill", "none")
                      .attr("stroke", function(d,i) { return legendColors[i]; })
                      .attr("stroke-linejoin", "round")
                      .attr("stroke-linecap", "round")
                      .attr("stroke-width", 3) //1.5)
                      .attr("id", "test_id")
                      .attr("class", "line")
                      .attr("d", line);
            lines.transition()
                    .attr("stroke", function(d,i) { return legendColors[i]; })
                    .attr("d", line);
            
          ///////
            
            
            component.animateFauxDOM(fauxDuration)

        }
    }
})