// const isFunctionDescriptor = descriptor => !descriptor.value || typeof descriptor.value === 'function';

const noop = () => null;

export const cloneInto = (target, source, {mutate = true, exclude = [], onDefine, noDelete = false, enumerableOnly = false, onDelete, shouldDelete = noop, shouldDefine = noop} = {}) => {

	let returnTarget = target;


	const getKeys = enumerableOnly ? Object.keys : Reflect.ownKeys;
	const propertyNames = new Set(getKeys(target).concat(getKeys(source)));

	if (!mutate) {
		returnTarget = [...propertyNames].reduce((acc, k) => (acc[k] = target[k], acc), {});
	}
	propertyNames.forEach(k => {
		if (exclude.includes(k)) {
			return;
		}
		const targetDescriptor = Object.getOwnPropertyDescriptor(target, k);
		const sourceDescriptor = Object.getOwnPropertyDescriptor(source, k);
		if (targetDescriptor &&
			!sourceDescriptor && shouldDelete(k, target, source) !== false
		) {
			if (targetDescriptor && !targetDescriptor.configurable) {
				return;
			}
			if (onDelete) {
				onDelete(k, target, source);
			}
			if (noDelete !== true) {
				Reflect.deleteProperty(target, k);
			}

		}
		if (sourceDescriptor
			&& (!targetDescriptor || targetDescriptor.configurable)
			&& shouldDefine(k, target, source) !== false) {
			const descriptor = onDefine ? onDefine(k, target, source) : sourceDescriptor;
			Object.defineProperty(returnTarget, k, descriptor, true);
		}
	});
	return returnTarget;
};
