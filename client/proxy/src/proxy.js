import {cloneInto} from './utils';
import autobind from 'autobind-decorator';
// import {bindAutoBindMethod} from './bindAutoBindMethods';
// import deleteUnknownAutoBindMethods from './deleteUnknownAutoBindMethods';
import React from 'react';

const noop = x => x;
const ownKeys = obj => Object.getOwnPropertyNames(obj).concat(Object.getOwnPropertySymbols(obj));

const objectProtoKeys = ownKeys(Object.getPrototypeOf({}));
// const deprecated = ['getDOMNode', 'isMounted', 'replaceProps', 'replaceState', 'setProps'];
const deprecated = [];
const internals = ['_reactInternalInstance', '__reactAutoBindMap', 'refs'];

const propDefaults = {
	enumerable: true,
	configurable: true,
	writable: true
};

const getProp = (obj, prop) => obj && obj[prop];

const propCache = Symbol('propCache');
const constructor = Symbol('constructor');
const reactProxy = Symbol('reactProxy');

const defineProxyProp = (obj, desc) => Object.defineProperty(obj, reactProxy, desc || {value: true});


const flattenPrototypes = (obj, exclude) => {
	const proto = Object.getPrototypeOf(obj);
	if (!proto) {
		return null;
	}
	const flattened = flattenPrototypes(proto, exclude) || obj;
	let keys = ownKeys(flattened);

	return keys.filter(k => !exclude.includes(k)).reduce((o, k) => {
		const protoDescriptor = Object.getOwnPropertyDescriptor(flattened, k);
		const ownDescriptor = Object.getOwnPropertyDescriptor(o, k);
		if (!ownDescriptor) {
			Object.defineProperty(o, k, protoDescriptor);
		}
		return o;
	}, obj);
};

// const curry = (fn, boundArgs) => (...args) => {
// 	args = boundArgs.concat(args);
// 	return fn(...args);
// };

const controlledObject = (object, instance) => {

	if (!instance.hasOwnProperty(propCache)) {
		Object.defineProperty(instance, propCache, {
			value: {}
		});
	}

	ownKeys(object).forEach(k => {
		const prop = instance[propCache][k] = Object.getOwnPropertyDescriptor(object, k);
		if (!prop.configurable) {
			return;
		}

		const getter = function() {

			let {value, get} = prop;

			if (!value && get) {
				value = get && get.call(this);
			}

			if (typeof value === 'function') {
				prop.bound = prop.bound || ((...args) => value.apply(instance, args));
				Object.defineProperty(prop.bound, reactProxy, {value: true});
				prop.bound.bind = (...args) => {
					const bound = Function.prototype.bind.call(prop.bound, null, ...args);
					defineProxyProp(bound);
					return bound;
				};
				return prop.bound;
			}

			return value;
		};


		const setter = function(v) {
			prop.wasSet = true;
			prop.value = prop.set
				? prop.set.call(this, v)
				: v;
		};

		defineProxyProp(getter);
		defineProxyProp(setter);

		Object.defineProperty(object, k, {
			configurable: true,
			enumerable: true,
			get: getter,
			set: setter
		});

	});
};

const deleteFromControlledOnbject = (controlled, k) => {
	const prop = controlled[propCache][k];
	if (prop && prop.bound) {
		prop.bound.call = noop;
		prop.bound.apply = noop;
	}
	Object.defineProperty(controlled, k, {
		enumerable: true,
		get() {
			if (prop && prop.wasSet) {
				return noop;
			}
		},
		set(value) {
			Object.defineProperty(this, k, {value, ...propDefaults});
		}
	});
};


@autobind
export class Proxy {
	constructor(Component) {

		this.instances = new Set();
		this.proxied = (props) => {
			const instance = this.updateInstance({props});
			Object.setPrototypeOf(instance, this.proxied.prototype);
			return instance;
		};

		this.update(Component);

		defineProxyProp(this.proxied, {value: this});
	}

	updateInstance(instance = {}, Component = this[constructor]) {

		const {instances} = this;
		const newInstance = new Component(instance.props);
		if (newInstance.componentWillMount) {
			newInstance.componentWillMount();
		}

		const exclude = objectProtoKeys.concat(deprecated);

		const flattened = flattenPrototypes(newInstance, exclude);

		const componentWillMount = flattened.componentWillMount || noop;
		const componentWillUnmount = flattened.componentWillUnmount || noop;

		Object.assign(flattened, {
			componentWillMount() {
				componentWillMount.call(this);
				instances.add(this);
			},
			componentWillUnmount() {
				componentWillUnmount.call(this);
				instances.delete(this);
			}
		});

		controlledObject(flattened, instance);

		Object.setPrototypeOf(flattened, {});

		flattened.state = instance.state || flattened.state || {};
		flattened.props = instance.props || flattened.props || {};
		flattened.context = instance.context || flattened.context || {};

		// for instance-descriptor tests, don't delete properties which aren't on the prototype of the Component.
		const namesToExclude = Object.keys(instance).filter(k => {
			const {get, set, value} = Object.getOwnPropertyDescriptor(instance, k);
			// if (k === 'increment') console.log(value)
			const hasProxySymbol = [get, set, value].some(x => getProp(x, reactProxy));
			return !hasProxySymbol;
		});


		cloneInto(instance, flattened, {
			exclude: internals.concat(namesToExclude),
			noDelete: true,
			enumerableOnly: true,
			onDelete(k, target) {
				deleteFromControlledOnbject(target, k);
			}
		});


		return instance;
	}

	update(Component) {
		const {instances} = this;
		instances.forEach(instance => this.updateInstance(instance, Component));
		this[constructor] = Component;
		cloneInto(this.proxied.prototype, Component.prototype);
		this.proxied.prototype.constructor = this.proxied;
	}

	get() {
		return this.proxied;
	}

}

export const createProxy = Component => {
	if (Component.hasOwnProperty(reactProxy)) {
		return Component[reactProxy];
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
