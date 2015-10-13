const ownKeys = obj => Object.getOwnPropertyNames(obj).concat(Object.getOwnPropertySymbols(obj));
const getDescriptor = Object.getOwnPropertyDescriptor;
const noop = () => null;

export default class ObservableObject {
	on(event, handler) {
		this.handlers[event] = handler;
	}
	emit(event, ...args) {
		return this.handlers[event].call(this, ...args);
	}
	createGetter(key, descriptor) {
		return () => {
			return this.emit('get', key, descriptor);
		};
	}
	createSetter(key, descriptor) {
		return (value) => {
			return this.emit('set', key, value, descriptor);
		};
	}
	defineObservable({key, descriptor}, target = this) {

		if (!this.isObservable(descriptor)) {
			return Object.defineProperty(target, key, descriptor);
		}

		const get = this.createGetter(key, descriptor);
		const set = this.createSetter(key, descriptor);

		return Object.defineProperty(target, key, {
			enumerable: descriptor.enumerable,
			get, set
		});
	}
	isObservable({configurable}) {
		return configurable;
	}
	constructor(object, mutate) {

		ownKeys(object)
			.map(key => ({
				key,
				descriptor: getDescriptor(object, key)
			}))
			.forEach(prop => {
				const target = mutate ? object : this;
				this.defineObservable(prop, target);
			});
	}

	handlers = {
		get: noop,
		set: noop
	}
}
