const instances = window.instances = new Map();

const extendComponent = (Component, loadName) => {
	const noop = x => x;
	const {componentWillMount = noop, componentWillUnmount = noop} = Component;
	Object.assign(Component.prototype, {
		componentWillMount() {
			componentWillMount.call(this);
			instances.set(loadName, instances.get(loadName).add(this));
		},
		componentWillUnmount() {
			componentWillUnmount.call(this);
			instances.set(loadName, instances.get(loadName).delete(this));
		}
	});
};

const updateInsances = (Component, loadName) => {
	const componentInstances = instances.get(loadName);
	if (componentInstances) {
		componentInstances.forEach(instance => {
			Object.setPrototypeOf(instance, Component.prototype);
			instance.forceUpdate();
		});
	}
};

const isReactComponent = obj =>
	Component.prototype &&
	Object.getPrototypeOf(Component.prototype).constructor.name === 'ReactComponent';

export default (loadName, {oldModule, newModule}) => {
	if (!oldModule) {
		instances.set(loadName, new Set());
		oldModule = newModule;
	}

	const Component = oldModule.default || oldModule;

	// only handle react components
	if (!isReactComponent(oldModule) || !(isReactComponent(oldModule))) {
		return Component;
	}

	oldModule.prototype = newModule.prototype;
	oldModule.__proto__ = newModule.__proto__;

	extendComponent(Component, loadName);
	updateInsances(Component, loadName);

	const Module = Object.getPrototypeOf(oldModule);
	if (Module.toString() !== 'Module') {
		return Component;
	}
	return Object.assign(new Module.constructor(), {
		default: Component
	});
};
