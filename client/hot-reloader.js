import React from 'react';
import {mapValues} from './utils';
import { createProxy, updateProxy } from './proxy/src';

const proxies = new Map();

const isReactComponent = Component =>
	typeof Component === 'function' && Component.prototype instanceof React.Component;

export default (loadName, {oldModule, newModule}) => {

	oldModule = oldModule || newModule;

	return mapValues(oldModule, (exp, k) => {

		const id = `${loadName}.${k}`;

		if (isReactComponent(exp)) {
			const proxy = createProxy(exp);
			proxies.set(id, proxy);
			return proxy.get();
		}

		if (proxies.has(id)) {
			const proxy = proxies.get(id);
			updateProxy(proxy, newModule[k]);
			return proxy.get();
		}

		return exp;
	});
};
