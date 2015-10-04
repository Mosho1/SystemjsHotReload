const loader = System;

const cachedModules = new Map();
const cachedHotReloaders = new Map();

const instantiate = loader.instantiate;
const register = loader.register;
const translate = loader.translate;
const fetch = loader.fetch;

const reload = (name, reloader, newModule) => {
	const oldModule = cachedModules.get(name);
	if (typeof newModule !== 'object') {
		newModule = {default: newModule};
	}
	newModule = loader.newModule(newModule);
	newModule = reloader(name, {oldModule, newModule});
	cachedModules.set(name, newModule);
	return loader.newModule(newModule);
};

const applyTransform = window.__applyHotReloadTransform = (name, module) => {
	if (!name || (typeof module !== 'object' && typeof module !== 'function')) {
		return module;
	}
	name = loader.normalizeSync(name);
	const cachedHotReloader = cachedHotReloaders.get(name);
	const hotReloader = cachedHotReloader && cachedHotReloader.default;

	if (!hotReloader) {
		return module;
	}

	return reload(name, hotReloader, module);
};

loader.register = (...args) => {
	const declare = args.pop();
	const declareWrapper = (_export, ...yargs) => {

		const wrappedExport = (loadName, name, value) =>
			typeof value === 'undefined'
				? _export(loadName, name)
				: _export(applyTransform(loadName, value));

		return declare(wrappedExport, ...yargs);
	};
	return register.call(loader, ...args, declareWrapper);
};

loader.fetch = load => {
	const hotReloaderName = load.metadata.hotReload;

	const hotReloaderImportPromise = hotReloaderName
		? System.import(hotReloaderName)
			.then(hotReloader => cachedHotReloaders.set(load.name, hotReloader))
		: Promise.resolve();

	return hotReloaderImportPromise.then(() => fetch.call(loader, load));
};

loader.translate = load => {
	const translatePromise = translate.call(loader, load);

	return translatePromise
		.then((source) => {
			if (load.metadata.hotReload) {
				source = source.replace(/_export\(/g, '_export(__moduleName, ');

				if (source.match(/\s+exports/)) {
					source += '\nObject.assign(exports, window.__applyHotReloadTransform(__filename, exports));';
				}
				if (source.match(/module\.exports/)) {
					source += '\nmodule.exports = window.__applyHotReloadTransform(__filename, module.exports);';
				}
			}

			return source;

		});
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
					return applyTransform(load.name, executed);
				}
			});
		});
};

const handleFileChange = path => {
	const moduleName = loader.normalizeSync(path);
	loader.delete(moduleName);
	loader.import(moduleName);
};

var es = new EventSource('http://localhost:8091/sse');
es.addEventListener('changed', event => {
	handleFileChange(event.data);
});

es.onerror = e => window.location.reload();
