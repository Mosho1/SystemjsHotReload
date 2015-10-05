export const set = (obj, keys, value) => {
	keys = (keys + '').split(/[.,]/);
	const lastKey = keys.pop();
	const lastInKeyChain = keys.reduce((cur, k) => cur[k] = cur[k] || {}, obj);
	lastInKeyChain[lastKey] = value;
	return obj;
};

export const get = (obj, keys = []) => (keys + '').split(/[.,]/).reduce((cur, k) => cur && cur[k], obj);

export const pick = (obj, toPick, cond = true) => {

	if (typeof toPick !== 'function') {
		const toPickArray = [].concat(toPick);
		toPick = (val, k) => toPickArray.indexOf(k) !== -1;
	}

	return Object.keys(obj).reduce((newObj, k) =>
		toPick(obj[k], k) == cond
			? set(newObj, [k], obj[k])
			: newObj,
		{});
};

export const omit = (obj, toOmit) => pick(obj, toOmit, false);

export const defaults = (target, ...sources) => {
	if (sources[0] == null) {
		return target;
	}
	sources.forEach(src =>
		Object.keys(src).forEach(k => {
			if (!target.hasOwnProperty(k)) {
				target[k] = src[k];
				return;
			}

			if (typeof target[k] === 'object' &&
				typeof src[k] === 'object') {
				target[k] = defaults(target[k], src[k]);
			}
		}));

	return target;
};

export const identity = x => x;

export const transform = (obj, valFn = identity, keyFn = identity) => {
	const ret = {};
	for (let k in obj) {
		if (obj.hasOwnProperty(k)) {
			ret[keyFn(k, obj[k], obj)] = valFn(obj[k], k, obj);
		}
	}
	return ret;
};

export const chain = (startObj, ...fns) =>
	fns.reduce((obj, [fn, ...args]) => fn(obj, ...args), startObj);

export const chainAsync = (startObj, ...fns) =>
	fns.reduce(async (obj, [fn, ...args]) => await fn(obj, ...args), startObj);

export const mapValues = (obj, fn) => transform(obj, fn, identity);
export const mapKeys = (obj, fn) => transform(obj, identity, fn);

export const partition = (obj, fn) => [pick(obj, fn), omit(obj, fn)];
