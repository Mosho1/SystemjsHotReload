import React from 'react';
import Child from './child.react';
export default class Parent extends React.Component {
	constructor(props) {
		super(props);
	}

	wat = 'awssda';

	render() {
		return <Child wat={this.wat + ''}/>;
	}
}
