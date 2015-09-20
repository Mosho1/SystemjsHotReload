const cachedModules = new Map();

const systemJSInstantiate = System.instantiate.bind(System);

System.instantiate = load => {
	const hotReloaderName = load.metadata.hotReload;
	if (!hotReloaderName) {
		return systemJSInstantiate(load);
	}

	return Promise.all([systemJSInstantiate(load), System.import(hotReloaderName)]).then(([module, hotReloader]) => {
		const moduleExecute = module.execute;
		return Object.assign(module, {
			execute() {
				const executed = moduleExecute();
				const oldModule = cachedModules.get(load.name);
				const newModule = hotReloader.default(load.name, {oldModule, newModule: executed});
				cachedModules.set(load.name, newModule);
				return newModule;
			}
		});
	});
};

const handleFileChange = path => {
	const moduleName = System.normalizeSync(path);
	System.delete(moduleName);
	System.import(moduleName);
};

var es = new EventSource('http://localhost:8081/sse');
es.addEventListener('changed', event => {
	handleFileChange(event.data);
});

es.onerror = () => window.location.reload();
