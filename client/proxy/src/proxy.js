import {cloneInto} from './utils';
import autobind from 'autobind-decorator';
import {bindAutoBindMethod} from './bindAutoBindMethods';
import deleteUnknownAutoBindMethods from './deleteUnknownAutoBindMethods';
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

const propCache = Symbol('propCache');
const constructor = Symbol('constructor');
const reactProxy = Symbol('reactProxy');


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

const controlledObject = (object, instance) => {
	ownKeys(object).forEach(k => {
		const prop = instance[propCache][k] = Object.getOwnPropertyDescriptor(object, k);
		if (!prop.configurable) {
			return;
		}
		Object.defineProperty(object, k, {
			configurable: true,
			enumerable: true,
			get() {
				const {value, get} = prop;
				if (value) {
					if (typeof value === 'function') {
						prop.bound = prop.bound || ((...args) => value.apply(instance, args));
						return prop.bound;
					} else {
						return value;
					}
				} else {
					return get && get.call(this);
				}
			},
			set(v) {
				prop.wasSet = true;
				if (prop.set) {
					prop.value = prop.set.call(this, v);
				} else {
					prop.value = v;
				}
			}
		});

	});
};

const deleteFromControlledOnbject = (controlled, k) => {
	const prop = controlled[propCache][k];
	// if (!prop || !prop.controlled) {
	// 	console.log(k)
	// 	return;
	// }
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

		Object.defineProperty(this.proxied, reactProxy, {value: this});

	}

	updateInstance(instance = {}, Component = this[constructor]) {

		const {instances} = this;
		const newInstance = new Component(instance.props);
		if (newInstance.componentWillMount) {
			newInstance.componentWillMount();
			// console.log(newInstance)
		}

		const exclude = objectProtoKeys.concat(deprecated);


		const flattened = flattenPrototypes(newInstance, exclude);

		if (!instance.hasOwnProperty(propCache)) {
			Object.defineProperty(instance, propCache, {
				value: {}
			});
		}

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

		cloneInto(instance, flattened, {
			exclude: internals,
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
		this[constructor] = Component;

		instances.forEach(instance => this.updateInstance(instance, Component));
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
