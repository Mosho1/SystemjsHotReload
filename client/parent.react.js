import React from 'react';

export default class Parent extends React.Component {
	constructor(props) {
		super(props);
		this.wat = props.wat + 'aaaaasdawdxxsa';
	}
	render() {
		return <div>{this.wat}</div>;
	}
}
