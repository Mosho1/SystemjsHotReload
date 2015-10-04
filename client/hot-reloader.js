const instances = window.instances = new Map();

const extendComponent = (loadName, Component) => {
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

const updateInstances = (loadName, Component) => {
	const componentInstances = instances.get(loadName);
	if (componentInstances) {
		componentInstances.forEach(instance => {
			Object.setPrototypeOf(instance, Component.prototype);
			instance.forceUpdate();
		});
	}
};

const isReactComponent = Component =>
	Component.prototype &&
	Object.getPrototypeOf(Component.prototype).constructor.name === 'ReactComponent';

const reloadComponent = (loadName, oldComponent, newComponent) => {
	oldComponent.prototype = newComponent.prototype;

	if (newComponent === oldComponent) {
		extendComponent(loadName, oldComponent);
	}

	updateInstances(loadName, oldComponent);
};

export default (loadName, {oldModule, newModule}) => {
	if (!oldModule) {
		instances.set(loadName, new Set());
		oldModule = newModule;
	}

	if (isReactComponent(oldModule.default)) {
		reloadComponent(loadName, oldModule.default, newModule.default);
		return oldModule;
	}

};
