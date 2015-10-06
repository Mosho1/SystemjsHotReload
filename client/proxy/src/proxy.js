import {cloneInto} from './utils';
import autobind from 'autobind-decorator';
import bindAutoBindMethods from './bindAutoBindMethods';
import deleteUnknownAutoBindMethods from './deleteUnknownAutoBindMethods';
import React from 'react';
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
		cloneInto(this.proxied, Component);
		cloneInto(this.proxied.prototype, Component.prototype);
		this.proxied.__proto__ = Component.__proto__;
		Object.setPrototypeOf(this.proxied.prototype, Component.prototype);
	}

	update(Component) {
	
		if (this.proxied.prototype.isPrototypeOf(Component.prototype) ||
			this.proxied.prototype === Component.prototype) {
			return this;
		}

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
				Object.setPrototypeOf(instance, this.proxied.prototype);
				const newComponent = new Component(instance.props);

				const exclude = ['state',
					'constructor',
					'refs',
					'_reactInternalInstance',
					'getDOMNode',
					'props',
					'context',
					'prototype',
					'__proto__',
					'type'
				];
				// cloneInto(instance, this.proxied.prototype, {
				// 	exclude,
				// 	// enumerableOnly: true,
				// 	noDelete: true,
				// 	onDelete(k, target) {
				// 		const noop = x => x;
				// 		// console.log(target[k])
				// 		// target[k].call = noop;
				// 		// target[k].apply = noop;
				// 		// target[k] = noop;
				// }});

				// const deletedKeys = Reflect.ownKeys(instance.__proto__)
						// .filter(k =>
							// this.proxied.prototype.hasOwnProperty(k));

				// deletedKeys.map(k => )

				// Object.assign(instance, this.proxied.prototype);

				const instanceProto = instance.__proto__;

				Reflect.ownKeys(instanceProto).concat(Reflect.ownKeys(instance))
					.filter(k => !exclude.includes(k) && !this.proxied.prototype.hasOwnProperty(k))
					.forEach(k => {
						const noop = x => x;
						console.log(k)
						if (instance[k]) {
							instance[k].call = noop;
							instance[k].apply = noop;
							instance[k] = noop;
						}
						if (instanceProto[k]) {
							instanceProto[k].call = noop;
							instanceProto[k].apply = noop;
							instanceProto[k] = noop;
						}
					});

				Object.setPrototypeOf(instance, this.proxied.prototype);
				Reflect.ownKeys(instance)
					.filter(k => !exclude.includes(k) && instance.__proto__.hasOwnProperty(k))
					.forEach(k => delete instance[k]);



				// Reflect.ownKeys(this.proxied.prototype)
				// 	.filter(k => instance)

				// cloneInto(instance.__proto__, this.proxied.prototype, {
				// 	exclude,
				// 	// enumerableOnly: true,
				// 	noDelete: true,
				// 	onDelete(k, target) {
				// 		const noop = x => x;
				// 		// console.log(target[k])
				// 		// target[k].call = noop;
				// 		// target[k].apply = noop;
				// 		// target[k] = noop;
				// }});

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
