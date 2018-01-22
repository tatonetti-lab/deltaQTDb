// deltaQT Database - Drug Omnibar, Updated March 28, 2017 
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

var request = null;
class DrugSelect extends React.Component {
	displayName: 'DrugSelect';
	constructor (props) {
        super(props);
        this.handleSelectChange = this.handleSelectChange.bind(this);
        this.callAPI = this.callAPI.bind(this);
        this.toggleMales = this.toggleMales.bind(this);
        this.toggleFemales = this.toggleFemales.bind(this);
		this.state = {
			options: drugs,
			value: [],
            deltas: this.props.deltas,
            males: this.props.males, //true,
            females: this.props.females, //true,
            loadingIconStyle: {float:"right", display:"none"},
            numPatients: '',
            labUsed: [],
            labOptions: [
                { value: 'Lab One', label: 'Lab One' },
                { value: 'Lab Two', label: 'Lab Two' },
              ]
		};
	}

	handleSelectChange (value) {
//		debug('You\'ve selected:', value);    
        
		this.setState({ value
        }, () => { this.callAPI(); } );              
    }
    
    handleLabChange (value) {
        console.log(value);
    }

    callAPI () {
        this.setState( {loadingIconStyle: {float:"right", display:"", "margin-right": "25px"}} );
        this.setState( {numPatients: ''} );    
        
        var entries = this.state.value;
        
        if (entries == '') {
            debug('No entries; no API call necessary');
            if (request) {
                // debug("Resolving any ongoing fetch calls to prevent plotting when no drugs selected");
                debug("Pre-resolve:",request);
                Promise.resolve(request)
                    .then(function() {
                        // this.setState( {numPatients: ''} );
                        this.setState( {loadingIconStyle: {float:"right", display:"none"}} );
                        this.props.onDeltaChange([], [], []);
                        debug("Post-resolve:",request);
                    }.bind(this));
            } else {
                // this.setState( {numPatients: ''} );
                this.setState( {loadingIconStyle: {float:"right", display:"none"}} );
                this.props.onDeltaChange([], [], []);
            }
        }
        
        else {
            // Assign names to selected drugs
            // debug(entries);
            var drugs = [];
            $.each(entries.split(','), function(index, value){
               drugs.push( drugMap[value] );
            });
            // debug("Selected drugs:", drugs);

            var api_call = '/api/v1/query?drugs='+entries;
            debug(api_call);
            
            request = fetch(api_call) // http://stackoverflow.com/a/41059178
                .then(function(response) {
                    // Convert to JSON
                    return response.json();
                })
                .then(function(j) {
                    // `j` is a JavaScript object
                    var backgrounds = [];
                    if (drugs.length > 1) {
                        var splitEntries = entries.split(',');
                        var lastDrugID = "cache_" + splitEntries[splitEntries.length-1];
                        // debug("lastDrugID",lastDrugID);
                        backgrounds = j[lastDrugID];
                    }
                    // debug("Selected drugs post-API:", drugs);
                    var delta_qts = j['delta_qts'];

                    this.setState( {loadingIconStyle: {float:"right", display:"none"}} );

                    if (delta_qts.length == 0) {
                        this.setState( {numPatients: 'No patients found'} );
                    } else {
                        this.setState( {numPatients: ''} );
                    }
                
                    request = null;
                    this.props.onDeltaChange(backgrounds, delta_qts,  drugs);
                }.bind(this)) //;
                .catch(function(ex) {
                    debug('Parsing failed', ex);
                    request = null;
                    
                    // this.setState( {numPatients: ''} );
                    this.setState( {loadingIconStyle: {float:"right", display:"none"}} );
                    this.props.onDeltaChange([], [], []);
                }.bind(this));
        }
        
    }

//	toggleDisabled (e) {
//		this.setState({ disabled: e.target.checked });
//	}
    
    toggleMales () {
		this.setState({
			males: !this.state.males // http://stackoverflow.com/a/40408976
        }, () => { this.props.onSexChange(this.state.males, this.state.females); } );
	}
    toggleFemales () {
		this.setState({
			females: !this.state.females
		}, () => { this.props.onSexChange(this.state.males, this.state.females); } );
	}
    
    // Loading svg from http://cezarywojtkowski.com/react-loading/
	render () {
        var numPtsStyle = {float:"right"};
        
        return (
			<div className="section">
                <Select multi simpleValue name="selected-lab" joinValues
                 value={this.state.labUsed}
                 placeholder="Select lab..."
                 noResultsText="Lab not found" 
                 options={this.state.labOptions}
                 onChange={this.handleLabChange} />

				<Select multi simpleValue name="selected-drugs" joinValues
                 value={this.state.value}
                 placeholder="Select drug(s)..."
                 noResultsText="Drug not found" 
                 options={this.state.options}
                 onChange={this.handleSelectChange} />

				<div className="checkbox-list">
					<label className="checkbox-inline">
						<input type="checkbox" className="checkbox-control" checked={this.state.males} onChange={this.toggleMales} />
						<span className="checkbox-label">Males</span>
					</label>
                    {' '}
					<label className="checkbox-inline">
						<input type="checkbox" className="checkbox-control" checked={this.state.females} onChange={this.toggleFemales} />
						<span className="checkbox-label">Females</span>
					</label>
                    <div style={this.state.loadingIconStyle}><img src={"/index/img/loading.svg"} height="18px"/></div>
                    <div style={numPtsStyle}>{this.state.numPatients}</div>
				</div>
			</div>
		);
	}
}