export const cloneInto = (target, source, {exclude = []} = {}) => {
	for (let k in target) {
		if (target.hasOwnProperty(k)) {
			if (!source.hasOwnProperty(k)) {
				delete target[k];
			}
		}
	}
	Object.getOwnPropertyNames(source).forEach(k => {
		const targetDescriptor = Object.getOwnPropertyDescriptor(target, k);
		const sourceDescriptor = Object.getOwnPropertyDescriptor(source, k);
		if (!targetDescriptor || (targetDescriptor.writable && targetDescriptor.configurable)) {
			Object.defineProperty(target, k, sourceDescriptor);
		}
	});
	// for (let k in source) {
	// 	if (source.hasOwnProperty(k) && !exclude.includes(k)) {
	// 		target[k] = source[k];
	// 	}
	// }
	return target;
};
