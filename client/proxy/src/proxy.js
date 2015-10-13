import {cloneInto} from './utils';
import autobind from 'autobind-decorator';
import ObservableObject from './observable-object.js';

const noop = x => x;
const ownKeys = obj => Object.getOwnPropertyNames(obj).concat(Object.getOwnPropertySymbols(obj));
const getDescriptor = Object.getOwnPropertyDescriptor;

const objectProtoKeys = ownKeys(Object.getPrototypeOf({}));
const functionProtoKeys = ownKeys(Object.getPrototypeOf(function(){}));
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
const originalFn = Symbol('original unbound fn');
const protoBind = Function.prototype.bind;
Function.prototype.bind = function(...args) {
	const bound = protoBind.apply(this, args);
	bound[originalFn] = this;
	return bound;
};

const defProp = Object.defineProperty;
Object.defineProperty = (context, key, descriptor, noCache) => {
	if (context[propCache] && !noCache) {
		context[propCache][key] = {dirty: true};
	}
	return defProp(context, key, descriptor);
};

const defineProxyProp = (obj, desc) => defProp(obj, reactProxy, desc || {value: true});

const flattenPrototypes = (obj, exclude) => {
	const proto = Object.getPrototypeOf(obj);

	if (!proto) {
		return null;
	}

	const flattened = flattenPrototypes(proto, exclude) || obj;
	let keys = ownKeys(flattened);

	obj = keys.filter(k => !exclude.includes(k)).reduce((o, k) => {
		const protoDescriptor = getDescriptor(flattened, k);
		const ownDescriptor = getDescriptor(o, k);
		if (!ownDescriptor) {
			defProp(o, k, protoDescriptor);
		}
		return o;
	}, obj);

	// Object.setPrototypeOf(obj, proto);

	return obj;
};

// const curry = (fn, boundArgs) => (...args) => {
// 	args = boundArgs.concat(args);
// 	return fn(...args);
// };

const controlledObject = (object, instance) => {

	if (!instance.hasOwnProperty(propCache)) {
		defProp(instance, propCache, {
			value: {}
		});
	}

	ownKeys(object).forEach(k => {
		const cachedProp = instance[propCache][k] = instance[propCache][k] || {};
		cachedProp.prop = getDescriptor(object, k);
		if (!cachedProp.prop.configurable) {
			return;
		}

		cachedProp.context = instance;
		cachedProp.value = cachedProp.prop.value;
		cachedProp.wasSet = false;

		cachedProp.getter = cachedProp.getter || function() {

			if (!cachedProp.prop.value && cachedProp.prop.get) {
				const desc = getDescriptor(this, k);
				// defProp(this, k, {});
				const defineProperty = Object.defineProperty;
				let isAutobind;
				Object.defineProperty = (context, key, descriptor) => {
					if (context === this && key === k) {
						isAutobind = true;
					} else {
						return defineProperty(context, key, descriptor);
					}
				};
				const {get} = cachedProp.prop;

				cachedProp.value = get && get.call(this);
				if (isAutobind) {

					cachedProp.value = get && get.call();
				}
				Object.defineProperty = defineProperty;
				// defProp(this, k, desc);

			}

			if (typeof cachedProp.value === 'function') {
				if (!cachedProp.bound) {

					cachedProp.bound = (...args) =>
						cachedProp.value.apply(cachedProp.context, args);

					defineProxyProp(cachedProp.bound);

					cachedProp.bound.bind = (...args) => {
						return cachedProp.bound;
					};
				}
				return cachedProp.bound;
			}
			return cachedProp.value;
		};

		cachedProp.setter = cachedProp.setter || function(v) {
			const {set} = cachedProp.prop;
			cachedProp.wasSet = true;
			if (cachedProp.bound === v) {
				return;
			}

			cachedProp.value = set
				? set.call(this, v)
				: v;
		};

		defineProxyProp(cachedProp.getter);
		defineProxyProp(cachedProp.setter);
		defProp(object, k, {
			configurable: true,
			enumerable: true,
			get: cachedProp.getter,
			set: cachedProp.setter
		});

	});
};

const deleteFromControlledOnbject = (controlled, k) => {
	const prop = controlled[propCache][k];
	if (prop && prop.bound) {
		prop.bound.call = noop;
		prop.bound.apply = noop;
	}
	defProp(controlled, k, {
		enumerable: true,
		get() {
			if (prop && prop.wasSet) {
				return noop;
			}
		},
		set(value) {
			defProp(this, k, {value, ...propDefaults});
		}
	});
};


@autobind
export class Proxy {
	constructor(Component) {
		this[constructor] = Component;
		this.proxied = (props) => {
			const instance = this.updateInstance({props});
			Object.setPrototypeOf(instance, this.proxied.prototype);
			return instance;
		};

	    cloneInto(this.proxied.prototype, Component.prototype);
		this.proxied.prototype.instances = this.instances = Component.prototype.instances || new Set();
		this.wrapLifestyleMethods(this.proxied.prototype);

		this.proxied[propCache] = {...this.proxied};

		if (!this.proxied.hasOwnProperty(propCache)) {
			defProp(this.proxied, propCache, {
				value: {},
				configurable: true
			});
		}

		this.update(Component);

		defineProxyProp(this.proxied, {value: this});
	}

	wrapLifestyleMethods(component) {


		const {instances} = this;

		const componentWillMount = component.componentWillMount || noop;
		const componentWillUnmount = component.componentWillUnmount || noop;

		if (component.componentWillMount && component.componentWillMount[reactProxy] === true) {
			return;
		}

		Object.assign(component, {
			componentWillMount() {
				componentWillMount.call(this);
				instances.add(this);
			},
			componentWillUnmount() {
				componentWillUnmount.call(this);
				instances.delete(this);
			}
		});

		component.componentWillMount[reactProxy] = true;

	}

	updateInstance(instance = {}, Component = this[constructor]) {

		const {instances} = this;

		const newInstance = new Component(instance.props);
		if (newInstance.componentWillMount && !newInstance.componentWillMount[reactProxy]) {
			newInstance.componentWillMount();
		}

		const exclude = objectProtoKeys.concat(deprecated);

		const flattened = flattenPrototypes(newInstance, exclude);

		this.wrapLifestyleMethods(flattened);

		flattened.state = instance.state || flattened.state || {};
		flattened.props = instance.props || flattened.props || {};
		flattened.context = instance.context || flattened.context || {};

		controlledObject(flattened, instance);

		// for instance-descriptor tests, don't delete properties which aren't on the prototype of the Component.
		const namesToExclude = Object.keys(instance).filter(k => {
			const {get, set, value} = getDescriptor(instance, k);
			const hasProxySymbol = [get, set, value].some(x => getProp(x, reactProxy));
			return !hasProxySymbol;
		});

		const instanceProtoKeys = ownKeys(Object.getPrototypeOf(instance));
		const newProtoKeys = ownKeys(Component.prototype);
		const oldProtoKeys = ownKeys(this[constructor].prototype);

		namesToExclude.push(...instanceProtoKeys.filter(k =>
			!newProtoKeys.includes(k) && !oldProtoKeys.includes(k)));
		if (instance.constructor[reactProxy]) {
			cloneInto(instance.constructor, Component, {
				exclude:  ['length', 'name', 'prototype', 'bind', 'call', 'apply', propCache, reactProxy]
			});
		}

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
		const exclude = objectProtoKeys.concat(deprecated).concat('arguments', 'caller');
		Component = flattenPrototypes(Component, exclude);
		cloneInto(this.proxied.prototype, Component.prototype);
		this.proxied.prototype.instances = this.instances = instances;
		instances.forEach(instance => this.updateInstance(instance, Component));

		cloneInto(this.proxied, Component, {
			exclude: ['type', propCache, reactProxy],
			// enumerableOnly: true,
			shouldDefine: (k, target) => {
				const cache = target[propCache][k];
				const isProxy = target.hasOwnProperty(reactProxy);
				if (isProxy && cache && cache.dirty) {
					return false;
				}
			},
			shouldDelete: (k, target) => {
				const cache = target[propCache][k];
				if (!cache || (cache && cache.dirty)) {
					return false;
				}
			}
		});

		this[constructor] = Component;

		if (Component[propCache]) {
			this.proxied[propCache] = Object.assign(this.proxied[propCache] || {}, Component[propCache]);
		}

		const cache = ownKeys(this.proxied).reduce((acc, k) => (acc[k] = {value: this.proxied[k]}, acc), {});
		const observableObject = new ObservableObject(this.proxied, true);
		observableObject.on('get', function(key, descriptor) {
			return cache[key].value;
		});
		console.log(this.proxied.getAnswer)
		observableObject.on('set', (key, value, descriptor) => {
			let set, oldSet = descriptor.set;
			if (oldSet && oldSet[reactProxy]) {
				set = oldSet;
			} else {
				set = oldSet
					? function(v) {
						cache[key].value = oldSet.call(this, v);
					}
					: function(v) {
						const origFn = v[originalFn];
						const oldValue = cache[key].value;
						const newValue = origFn
								? v[originalFn]
								: v;
						cache[key].dirty = newValue !== oldValue;
						cache[key].value = newValue;
					};
			}
			set(value);
		});

		this.wrapLifestyleMethods(this.proxied.prototype);
		this.proxied.prototype.constructor = this.proxied;

		return [...instances];
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
