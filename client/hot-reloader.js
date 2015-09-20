const instances = new Map();

export default (oldModule, newModule) => {

	if (!oldModule) {
		instances.set(newModule, new Set());
		const Component = newModule.default;
		const Module = Object.getPrototypeOf(newModule);
		return Object.assign(new Module.constructor(), {
			default: class CachedComponent extends Component {
				componentWillMount() {
					instances.set(newModule, instances.get(newModule).add(this));
				}
				componentWillUnmount() {
					instances.set(newModule, instances.get(newModule).delete(this));
				}
			}
		});
	} else {
		oldModule.default.prototype = newModule.default.prototype;
		const componentInstances = instances.get(oldModule);
		if (componentInstances) {
			componentInstances.forEach(instance => instance.forceUpdate());
		}
		return oldModule;
	}
};
