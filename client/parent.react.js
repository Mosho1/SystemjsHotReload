import React from 'react';
import Child from './child.react';
export default class Parent extends React.Component {
	constructor(props) {
		super(props);
	}

	wat = 'da';

	componentWillReceiveProps(props) {
		this.wat = props.wat;
	}

	render() {
		return <Child wat={this.wat + '' + Parent.wet}/>;
	}
}


console.log(Parent.wet);