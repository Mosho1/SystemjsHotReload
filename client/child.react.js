import React from 'react';
export default class Child extends React.Component {
	constructor(props) {
		super(props);
		this.wat = props.wat + '';
	}
	componentWillReceiveProps(props) {
		this.wat = props.wat + 'awaaaaad';
	}
	render() {
		return <div>{this.wat + 'www'}</div>;
	}
}
