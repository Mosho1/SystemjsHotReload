// const isFunctionDescriptor = descriptor => !descriptor.value || typeof descriptor.value === 'function';

export const cloneInto = (target, source, {exclude = [], onDefine, noDelete = false, enumerableOnly = false, onDelete} = {}) => {

	const getKeys = enumerableOnly ? Object.keys : Reflect.ownKeys;
	const propertyNames = new Set(getKeys(target).concat(getKeys(source)));
	propertyNames.forEach(k => {
		if (exclude.includes(k)) {
			return;
		}

		const targetDescriptor = Object.getOwnPropertyDescriptor(target, k);
		const sourceDescriptor = Object.getOwnPropertyDescriptor(source, k);
		if (targetDescriptor &&
			!sourceDescriptor
			// isFunctionDescriptor(targetDescriptor)
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
			) {
			const descriptor = onDefine ? onDefine(k, target, source) : sourceDescriptor;
			Object.defineProperty(target, k, descriptor);
		}
	});
	return target;
};
