System.config({
  baseURL: "/",
  defaultJSExtensions: true,
  transpiler: "babel",
  babelOptions: {
    stage: 0,
    "optional": [
      "runtime"
    ]
  },
  paths: {
    "github:*": "jspm_packages/github/*",
    "npm:*": "jspm_packages/npm/*",
    "react": "//cdnjs.cloudflare.com/ajax/libs/react/0.13.3/react.js"
  },

  meta: {
    "*.react.js": {
      "hotReload": "hot-reloader"
    },
    "index.js": {
      "hotReload": true
    }
  },

  map: {
    "babel": "npm:babel-core@5.8.25",
    "babel-core": "npm:babel-core@5.8.25",
    "babel-runtime": "npm:babel-runtime@5.8.24",
    "core-js": "npm:core-js@0.9.18",
    "lodash": "npm:lodash@3.10.1",
    "react-proxy": "npm:react-proxy@1.1.1",
    "github:jspm/nodelibs-path@0.1.0": {
      "path-browserify": "npm:path-browserify@0.0.0"
    },
    "github:jspm/nodelibs-process@0.1.1": {
      "process": "npm:process@0.10.1"
    },
    "npm:babel-runtime@5.8.24": {
      "process": "github:jspm/nodelibs-process@0.1.1"
    },
    "npm:core-js@0.9.18": {
      "fs": "github:jspm/nodelibs-fs@0.1.2",
      "process": "github:jspm/nodelibs-process@0.1.1",
      "systemjs-json": "github:systemjs/plugin-json@0.1.0"
    },
    "npm:lodash@3.10.1": {
      "process": "github:jspm/nodelibs-process@0.1.1"
    },
    "npm:path-browserify@0.0.0": {
      "process": "github:jspm/nodelibs-process@0.1.1"
    },
    "npm:react-proxy@1.1.1": {
      "lodash": "npm:lodash@3.10.1",
      "path": "github:jspm/nodelibs-path@0.1.0",
      "react-deep-force-update": "npm:react-deep-force-update@1.0.0"
    }
  }
});
