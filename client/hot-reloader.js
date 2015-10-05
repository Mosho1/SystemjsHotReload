import React from 'react';
import {mapValues} from './utils';

const proxies = new Map();

class Proxy {
	constructor(Component) {
		this.instances = new Set();
		this.update(Component);

		this.get = this.get.bind(this);
	}

	update(Component) {

		const {instances} = this;

		const noop = x => x;
		const {componentWillMount = noop, componentWillUnmount = noop} = Component;

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

		this.__constructor = Component;

		instances.forEach(instance => {
			Object.setPrototypeOf(instance, Component.prototype);
			Object.assign(instance, new Component(instance.props));
		});
	}

	get() {
		return (...args) => {
			return new this.__constructor(...args);
		};
	}

}

const createProxy = Component => {
	return new Proxy(Component);
};

const updateProxy = (proxy, NewComponent) => {
	proxy.update(NewComponent);
	proxy.instances.forEach(instance => {
		instance.forceUpdate();
	});
	return proxy;
};

const isReactComponent = Component =>
	typeof Component === 'function' && Component.prototype instanceof React.Component;

export default (loadName, {oldModule, newModule}) => {

	oldModule = oldModule || newModule;

	return mapValues(oldModule, (exp, k) => {

		const id = `${loadName}.${k}`;

		if (isReactComponent(exp)) {
			const proxy = createProxy(exp);
			proxies.set(id, proxy);
			return proxy.get();
		}

		if (proxies.has(id)) {
			const proxy = proxies.get(id);
			updateProxy(proxy, newModule[k]);
			return proxy.get();
		}

		return exp;
	});
};


// with react-proxy:

// import React from 'react';
// import { createProxy, getForceUpdate } from 'react-proxy';
// import {mapValues} from './utils';

// const proxies = new Map();

// const isReactComponent = Component =>
// 	typeof Component === 'function' && Component.prototype instanceof React.Component;

// const forceUpdate = getForceUpdate(React);

// const reloadComponent = (loadName, OldComponent, NewComponent) => {

// 	// initial run
// 	if (NewComponent === OldComponent) {
// 		const proxy = createProxy(OldComponent);
// 		proxies.set(loadName, proxy);
// 		return proxy.get();
// 	} else {
// 		const proxy = proxies.get(loadName);
// 		const instances = proxy.update(NewComponent);
// 		instances.forEach(forceUpdate);
// 	}
// };

// export default (loadName, {oldModule, newModule}) => {

// 	if (!oldModule) {
// 		oldModule = newModule;
// 	}

// 	return mapValues(oldModule, (exp, k) =>
// 		isReactComponent(exp)
// 			? reloadComponent(loadName, exp, newModule[k])
// 			: exp);
// };


