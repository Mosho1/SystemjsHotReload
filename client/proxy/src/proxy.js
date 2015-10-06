import {cloneInto} from './utils';
import autobind from 'autobind-decorator';

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

		Object.defineProperty(this.proxied, 'name', {
			get: () => {
				return this.__constructor ? this.__constructor.name : '';
			}
		});

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
		
		cloneInto(this.proxied, Component);
		cloneInto(this.proxied.prototype, Component.prototype);
		this.proxied.__proto__ = Component.__proto__;
		Object.setPrototypeOf(this.proxied.prototype, Component.prototype);

		this.observe(Component);

		this.proxied.__reactProxy = this;
		this.proxied.displayName = Component.displayName || Component.name;
		const instancesArray = [...instances];

		instancesArray
			.filter(instance => instance.constructor === this.proxied)
			.forEach(instance => {
				Object.setPrototypeOf(instance, Component.prototype);
				Object.assign(instance, new Component(instance.props));
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
