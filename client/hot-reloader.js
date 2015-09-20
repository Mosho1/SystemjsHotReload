const instances = window.instances = new Map();

export default (loadName, {oldModule, newModule}) => {
	console.log(oldModule,newModule)
	if (!oldModule) {
		instances.set(loadName, new Set());
		oldModule = newModule;
	} else {
		oldModule.default.prototype = newModule.default.prototype;
		oldModule.default.__proto__ = newModule.default.__proto__;
	}
	
	const Component = oldModule.default;
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

	const Module = Object.getPrototypeOf(oldModule);
	const componentInstances = instances.get(loadName);

	if (componentInstances) {
		componentInstances.forEach(instance => {
			Object.setPrototypeOf(instance, Component.prototype);
			instance.forceUpdate();
		});
	}

	return Object.assign(new Module.constructor(), {
		default: Component
	});
};
