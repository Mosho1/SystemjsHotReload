const loader = System;

const cachedModules = new Map();
const cachedHotReloaders = new Map();

const instantiate = loader.instantiate;
const register = loader.register;
const translate = loader.translate;

loader.register = (...args) => {
	const declare = args.pop();
	const declareWrapper = (_export, ...yargs) => {

		const wrappedExport = (loadName, name, value) => {
			const cachedHotReloader = cachedHotReloaders.get(loadName);
			const hotReloader = cachedHotReloader && cachedHotReloader.default;
			if (!hotReloader) {
				return _export(name, value);
			}
			const oldModule = cachedModules.get(loadName);
			const newModule = hotReloader(loadName, {oldModule, newModule: value});
			cachedModules.set(loadName, newModule);
			_export(name, newModule);
		};

		return declare(wrappedExport, ...yargs);
	};
	return register.call(loader, ...args, declareWrapper);
};

loader.translate = load => {
	const hotReloaderName = load.metadata.hotReload;

	const hotReloaderImportPromise = hotReloaderName
		? System.import(hotReloaderName)
			.then(hotReloader => cachedHotReloaders.set(load.name, hotReloader))
		: Promise.resolve();

	const translatePromise = translate.call(loader, load);

	return Promise.all([translatePromise, hotReloaderImportPromise])
		.then(([source]) => source.replace(/_export\(/g, '_export(__moduleName, '));
};

loader.instantiate = load => {
	const hotReloaderName = load.metadata.hotReload;
	const instantiatePromise = instantiate.call(loader, load);
	if (!hotReloaderName) {
		return instantiatePromise;
	}

	return instantiatePromise.then(module => {
			const moduleExecute = module.execute;
			return Object.assign(module, {
				execute() {
					const executed = moduleExecute();
					const oldModule = cachedModules.get(load.name);
					const hotReloader = cachedHotReloaders.get(load.name);
					const newModule = hotReloader.default(load.name, {oldModule, newModule: executed});
					cachedModules.set(load.name, newModule);
					return newModule;
				}
			});
		});
};

const handleFileChange = path => {
	const moduleName = loader.normalizeSync(path);
	loader.delete(moduleName);
	loader.import(moduleName);
};

var es = new EventSource('http://localhost:8081/sse');
es.addEventListener('changed', event => {
	handleFileChange(event.data);
});

es.onerror = () => window.location.reload();
