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

// esm export hook
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

// import the loader plugin
loader.fetch = load => {
	const hotReloader = load.metadata.hotReload;

	const handler = {
		string: loader => System.import(loader)
			.then(importedHotReloader =>
				cachedHotReloaders.set(load.name, importedHotReloader)),
		function: loader => {
			cachedHotReloaders.set(load.name, loader);

			// add an entry here in the case where the loaded modules has no exports but we
			// still want to reload it (which would typically simply run the module unfancily)
			cachedModules.set(load.name, null);
		},
		boolean: loader => {
			if (loader) {
				cachedHotReloaders.set(load.name, x => x);
				cachedModules.set(load.name, null);
			}
		}
	}[typeof hotReloader] || () => null;


	const hotReloaderImportPromise = Promise.resolve(handler(hotReloader));

	return hotReloaderImportPromise.then(() => fetch.call(loader, load));
};

loader.translate = load => {
	const translatePromise = translate.call(loader, load);

	return translatePromise
		.then((source) => {
			// patch in the right hooks
			if (load.metadata.hotReload) {

				// esm patch
				source = source.replace(/_export\(/g, '_export(__moduleName, ');

				// cjs patches
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

const handleFileChange = path => {
	const moduleName = loader.normalizeSync(path);
	if (!cachedModules.has(moduleName)) {
		return;
	}
	console.log('reloading ' + moduleName);
	loader.delete(moduleName);
	loader.import(moduleName);
};

var es = new EventSource('http://localhost:{{port}}/sse');

es.addEventListener('changed', event => {
	handleFileChange(event.data);
});
