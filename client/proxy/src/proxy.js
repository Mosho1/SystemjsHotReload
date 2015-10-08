import {cloneInto} from './utils';
import autobind from 'autobind-decorator';
import bindAutoBindMethods from './bindAutoBindMethods';
import deleteUnknownAutoBindMethods from './deleteUnknownAutoBindMethods';
import React from 'react';
import flattenPrototypes from 'flatten-prototypes';
import bindall from 'lodash.bindall';

const proxify = obj => {
	return Reflect.ownKeys(obj).reduce((ret, k) => {
		Object.defineProperty(ret, k, {
			enumerable: true,
			writable: true,
			configurable: true,
			get() {
				return obj[k];
			}
		});
	}, {});
};

const bindContext = Symbol('bindContext');

const bind = (obj, context) => {
	context = context || obj;
	if (obj[bindContext]) {
		obj[bindContext] = context;
		return obj;
	}
	return Reflect.ownKeys(obj).reduce((ret, k) => {
		Object.defineProperty(obj, k, {
			enumerable: true,
			writable: true,
			configurable: true,
			get() {
				return obj[k].bind(obj[bindContext]);
			}
		});
	}, {});
};

@autobind
export class Proxy {
	constructor(Component) {

		this.instances = Component.prototype.instances || new Set();

		this.proxyProto = proxify(flattenPrototypes(Component.prototype));

		this.proxied = (...args) => {
			const instance = new this.__constructor(...args);
			const flattened = flattenPrototypes(instance);
			return bind(flattened);
		};

		this.update(Component);
	}

	

	update(Component) {

		// console.log(Component.prototype.componentWillMount.toString())

		const {instances} = this;

		const noop = x => x;

		let {componentWillMount, componentWillUnmount} = Component.prototype;

		componentWillMount = componentWillMount || noop;
		componentWillUnmount = componentWillUnmount || noop;


		Object.assign(Component.prototype, {
			componentWillMount() {
				componentWillMount.call(this);
				instances.add(this);
			},
			componentWillUnmount() {
				componentWillUnmount.call(this);
				instances.delete(this);
			}
		});

		instances.forEach(instance => {
			
		});

		this.__constructor = Component;

	}

	get() {
		return this.proxied;
	}

}

export const createProxy = Component => {
	if (Component.hasOwnProperty('__reactProxy')) {
		return Component.__reactProxy;
	}
	return new Proxy(Component);
};

export const updateProxy = (proxy, NewComponent) => {
	proxy.update(NewComponent);
	proxy.instances.forEach(instance => {
		instance.forceUpdate();
	});
	return proxy;
};
