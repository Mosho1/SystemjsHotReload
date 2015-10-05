export const once = fn => {
	let ran = false;
	return function() {
		if (ran) {
			return;
		}
		fn(...arguments);
		ran = true;
	};
};
