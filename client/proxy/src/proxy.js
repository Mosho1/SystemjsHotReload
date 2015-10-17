import {cloneInto} from './utils';
import autobind from 'autobind-decorator';
import ObservableObject from './observable-object.js';
import FlatObject from './flat-object.js';
import EE from 'eventemitter3';
const noop = x => x;
const ownKeys = obj => Object.getOwnPropertyNames(obj).concat(Object.getOwnPropertySymbols(obj));
const getDescriptor = Object.getOwnPropertyDescriptor;
const getProto = Object.getPrototypeOf;

const objectProtoKeys = ownKeys(Object.getPrototypeOf({}));
const functionProtoKeys = ownKeys(Object.getPrototypeOf(function(){}));
const internals = ['_reactInternalInstance', '__reactAutoBindMap', 'refs'];

const propDefaults = {
	enumerable: true,
	configurable: true,
	writable: true
};

const getProp = (obj, prop, defaultValue) =>
	Array.isArray(prop)
		? (prop.reduce((cur, p) => cur && cur[p], obj) || defaultValue)
		: ((obj && obj[prop]) || defaultValue);

const propCache = Symbol('propCache');
const constructor = Symbol('constructor');
const reactProxy = Symbol('react proxy');
const originalFn = global.origFn = Symbol('original unbound fn');

const defProp = Object.defineProperty;

if (!Object.defineProperty.hijacked) {
	Object.defineProperty = (...args) => {
		Object.emitter.emit('Object.defineProperty', args);
		return defProp(...args);
	};
}

Object.emitter = new EE();
Object.defineProperty.hijacked = true;

const protoBind = Function.prototype.bind;
Function.prototype.bind = function(...args) {
	const bound = protoBind.apply(this, args);
	defProp(bound, originalFn, {value: this});
	return bound;
};

const defineProxyProp = (obj, desc) => defProp(obj, reactProxy, desc || {value: true});

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
		cachedProp.value = getProp(cachedProp.prop.value, originalFn, cachedProp.prop.value);
		cachedProp.wasSet = false;

		cachedProp.getter = cachedProp.getter || function() {

			if (!cachedProp.prop.value && cachedProp.prop.get) {
				const desc = getDescriptor(this, k);
				const {get} = cachedProp.prop;
				const got = get && get.call(this);
				cachedProp.value = getProp(got, originalFn, got);
				defProp(this, k, desc);
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
			instance[propCache].proxyConstructor = this.proxied;
			Object.setPrototypeOf(instance, this.proxied.prototype);
			return instance;
		};

		// cloneInto(this.proxied.prototype, Component.prototype);
		this.proxied.prototype.instances = this.instances = Component.prototype.instances || new Set();
		this.proxied.prototypeSet = this.prototypeSet = Component.prototypeSet || new Set();
		this.prototypeSet.add(this);
		this.wrapLifestyleMethods(this.proxied.prototype);

		this[propCache] = {};
		this.proxied[propCache] = {};

		this.proxied.type = this.proxied;

		this.updateConstructor(Component);

		defineProxyProp(this.proxied, {value: this});
		Object.emitter.on('Object.defineProperty', ([context, key, descriptor, noCache]) => {
			if (context === this.proxied && !noCache) {
				this[propCache][key] = {dirty: true};
			}
		});
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


		component.componentWillMount.toString = componentWillMount.toString.bind(componentWillMount);
		component.componentWillUnmount.toString = componentWillUnmount.toString.bind(componentWillUnmount);

		component.componentWillMount[reactProxy] = true;

	}

	updateInstance(instance = {}, Component = this[constructor]) {
		const newInstance = new Component(instance.props);
		if (newInstance.componentWillMount && !newInstance.componentWillMount[reactProxy]) {
			newInstance.componentWillMount();
		}

		const exclude = objectProtoKeys;
		const flattened = new FlatObject(newInstance, exclude);

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

		cloneInto(instance, flattened, {
			exclude: internals.concat(namesToExclude),
			noDelete: true,
			onDelete(k, target) {
				deleteFromControlledOnbject(target, k);
			}
		});

		return instance;
	}

	update(Component) {
		const instances = this.updateConstructor(Component);

		this.prototypeSet.forEach(p => {
			if (p !== this) {
				p.updateConstructor();
			}
		});

		return instances;
	}

	updateConstructor(Component = this[constructor]) {

		// update prototype
		const exclude = objectProtoKeys.concat(functionProtoKeys.filter(s => s !== 'name'));
		cloneInto(this.proxied.prototype, new FlatObject(Component.prototype, exclude), {
			exclude: ['instances']
		});
		// this.proxied.prototype.instances = this.instances = instances;

		// update statics
		const flatComponent = new FlatObject(Component, exclude);
		cloneInto(this.proxied, flatComponent, {
			exclude: ['type', 'prototypeSet', propCache, reactProxy],
			shouldDefine: (k, target) => {
				const cached = this[propCache][k];
				const isProxy = target.hasOwnProperty(reactProxy);
				if (isProxy && cached && cached.dirty) {
					return false;
				}
			},
			shouldDelete: (k, target) => {
				const cached = this[propCache][k];
				if (!cached || (cached && cached.dirty)) {
					return false;
				}
			}
		});

		// update instances
		this.instances.forEach(instance => {
			const proxyConstructor = getProp(instance, [propCache, 'proxyConstructor']);
			const updateComponent = !proxyConstructor || (proxyConstructor === this.proxied)
				? Component
				: proxyConstructor;
			this.updateInstance(instance, updateComponent);
		});

		const oldCache = this[propCache];

		let cache = ownKeys(this.proxied)
			.reduce((acc, k) => {
				acc[k] = {
					dirty: oldCache[k] && oldCache[k].dirty
				};

				// TODO: this is a hack, should not access this.proxied[k] at all
				try {
					acc[k].value = this.proxied[k];
				} catch(e) {

				}

				return acc;
			}, {});

		// if (Component[propCache]) {
			// cache = Object.assign(cache || {}, Component[propCache]);
		// }

		this[propCache] = cache;

		this[constructor] = Component;

		const observableObject = new ObservableObject(this.proxied);

		const get = key => {
			const {value} = this[propCache][key];
			return value;
		};

		const set = function(key, value, descriptor) {
			let oldSet = descriptor.set;
			let doSet = oldSet
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
			doSet.call(this, value);
		};

		observableObject
			.on('get', get)
			.on('set', set);

		// this.wrapLifestyleMethods(this.proxied.prototype);
		this.proxied.prototype.constructor = this.proxied;
		this.proxied.prototype.constructor.toString = Component.toString.bind(Component);

		return [...this.instances];
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
