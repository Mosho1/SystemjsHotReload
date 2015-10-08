import {cloneInto} from './utils';
import autobind from 'autobind-decorator';
import bindAutoBindMethods from './bindAutoBindMethods';
import deleteUnknownAutoBindMethods from './deleteUnknownAutoBindMethods';
import createShallowRenderer from './createShallowRenderer';
import bindall from 'lodash.bindall';
import React from 'react';

const renderer = createShallowRenderer();

@autobind
export class Proxy {
	constructor(Component) {

		this.instances = Component.prototype.instances || new Set();

		this.proxied = (...args) => {
			const instance = new this.__constructor(...args);
			instance.constructor = this.proxied;
			return instance;
		};

		Object.defineProperty(this.proxied, 'type', {
			get: () => {
				this.__constructor.type;
				return this.proxied;
			}
		});
		
		try {
			Object.defineProperty(this.proxied, 'name', {
				get: () => {
					return this.__constructor ? this.__constructor.name : '';
				}
			});
		} catch(e) {}

		this.update(Component);
	}

	observeHandler(changes) {

		const addHandler = ({name, object}) => this.proxied[name] = object[name];

		const handlers = {
			add: addHandler,
			update: addHandler,
			delete: ({name}) => delete this.proxied[name]
		};

		changes.forEach(c => handlers[c.type](c));
	}

	observe(Component) {

		if (!Object.observe) return;

		if (this.observed) {
			Object.unobserve(this.observed, this.observeHandler);
		}
		this.observed = Component;
		Object.observe(this.observed, this.observeHandler);
	}

	patch(Component) {
		// static stuff
		this.oldProxiedDisplayName = this.proxied.displayName
		cloneInto(this.proxied, Component);
		cloneInto(this.proxied.prototype, Component.prototype);
		// this.proxied.__proto__ = Component.__proto__;
		// this.proxied.prototype.__proto__ = Component.prototype;
		Object.setPrototypeOf(this.proxied, Object.getPrototypeOf(Component));
		Object.setPrototypeOf(this.proxied.prototype, Component.prototype);
	}

	update(Component) {

		// console.log(Component.prototype.componentWillMount.toString())
	
		if (this.proxied.prototype.isPrototypeOf(Component.prototype) ||
			this.proxied.prototype === Component.prototype) {
			return this;
		}

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
			},
			instances
		});
		this.__constructor = Component;

		this.patch(Component);
		this.observe(Component);

		this.proxied.__reactProxy = this;
		this.proxied.displayName = Component.displayName || Component.name;
		const instancesArray = [...instances];

		instancesArray
			.filter(instance => instance.constructor === this.proxied)
			.forEach(instance => {
				const exclude = ['state',
					'componentWillMount',
					'componentWillUnmount',
					'constructor',
					'refs',
					'_reactInternalInstance',
					'getDOMNode',
					'props',
					'context',
					'prototype',
					'__proto__',
					'type',
					'instances',
				];

				const instanceProto = Object.getPrototypeOf(instance);
				Object.setPrototypeOf(instance, this.proxied.prototype);
				const newInstance = new this.proxied(instance.props);
				newInstance.componentWillMount();
				// console.log(newInstance)
				if (!newInstance.hasOwnProperty('getDOMNode')) {
					// massive hack for autbind decorator
					Object.getOwnPropertyNames(this.proxied.prototype).filter(k => !exclude.includes(k)).forEach(k => {
						const getter = Object.getOwnPropertyDescriptor(this.proxied.prototype, k).get;
						if (!getter) return;
						const unboundFn = getter.call();
						delete instance[k];
						Object.defineProperty(instance, k, {
							get() {
								return unboundFn.bind(instance);
							},
							configurable: true
						});

						exclude.push(k)
					});
				} else {

					// console.log(Object.getOwnPropertyNames(this.proxied.prototype).filter(k => !exclude.includes(k)))
					console.log(this.proxied.prototype.increment.toString())
				}

				cloneInto(instance, newInstance, {exclude});

				// bindall(instance);

				Reflect.ownKeys(instanceProto).concat(Reflect.ownKeys(instance))
					.filter(k => !exclude.includes(k) && !this.proxied.prototype[k])
					.forEach(k => {
						if (newInstance.hasOwnProperty(k)) {
							instance[k] = newInstance[k];
							return;
						} else if (instance[k] && !(instance[k] instanceof Object)) {
							delete instance[k];
							return;
						}

						const noop = () => null;
						if (instance[k]) {
							instance[k].call = noop;
							instance[k].apply = noop;
						}
						if (instance.hasOwnProperty(k)) {

							const reactBoundContext = instance[k].__reactBoundContext;
							const reactBoundArgs = instance[k].__reactBoundArguments;

							if (!reactBoundContext) {
								this.proxied.prototype[k] = noop;
							} else if (reactBoundArgs) {
								instance[k] = noop;
							} else {
								delete instance[k];
							}

						} else {
							delete this.proxied.prototype[k];
						}
					});



				Reflect.ownKeys(instance)
					.filter(k => !exclude.includes(k) && instance.__proto__.hasOwnProperty(k))
					.forEach(k => delete instance[k]);


				bindAutoBindMethods(instance);
				deleteUnknownAutoBindMethods(instance);


			});
		return instancesArray;
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
