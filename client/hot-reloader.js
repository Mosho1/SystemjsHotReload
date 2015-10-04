import React from 'react';

const instances = window.instances = new Map();

const extendComponent = (loadName, Component) => {
	const noop = x => x;
	const {componentWillMount = noop, componentWillUnmount = noop} = Component;

	const DynamicClass = function(...args) {
		return new DynamicClass.__constructor(...args);
	};

	DynamicClass.__constructor = Component;

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

	return DynamicClass;
};

const updateInstances = (loadName, oldComponent, newComponent) => {
	oldComponent.__constructor  = newComponent;
	const componentInstances = instances.get(loadName);
	if (componentInstances) {
		componentInstances.forEach(instance => {
			// set old prototypes
			Object.setPrototypeOf(instance, newComponent.prototype);

			// set instance props
			Object.assign(instance, new newComponent(instance.props));
			instance.forceUpdate();
		});
	}
};

const isReactComponent = Component =>
	typeof Component === 'function' && Component.prototype instanceof React.Component;

const reloadComponent = (loadName, oldComponent, newComponent) => {

	if (newComponent === oldComponent) {
		oldComponent = extendComponent(loadName, oldComponent);
	}

	updateInstances(loadName, oldComponent, newComponent);
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
