const ownKeys = obj => Object.getOwnPropertyNames(obj).concat(Object.getOwnPropertySymbols(obj));
const getDescriptor = Object.getOwnPropertyDescriptor;
const defProp = Object.defineProperty;
const setProto = Object.setPrototypeOf;

export default class FlatObject {

	constructor(obj, exclude = []) {
		const ret = this.flatten(setProto({}, obj), exclude);
		return ret;
	}

	flatten(obj, exclude) {
		const proto = Object.getPrototypeOf(obj);

		if (!proto) {
			return null;
		}

		const flattened = this.flatten(proto, exclude) || obj;
		let keys = ownKeys(flattened);

		obj = keys.filter(k => !exclude.includes(k)).reduce((o, k) => {
			const protoDescriptor = getDescriptor(flattened, k);
			const ownDescriptor = getDescriptor(o, k);
			if (!ownDescriptor) {
				defProp(obj, k, protoDescriptor);
			}
			return o;
		}, obj);

		return obj;
	}
}
