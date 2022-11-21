const { builtinModules } = require('module');

const builtins = builtinModules.filter((m) => !m.startsWith('_'));

module.exports = {
  build: {
    lib: {
      /**
       * This is the main entry point for your application, it's the first file
       * that runs in the main process.
       */
      entry: './src/main.js',
      // At present, Electron can only support CommonJs.
      formats: ['cjs'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: ['electron', ...builtins, ...builtins.map((m) => `node:${m}`)],
    },
  },
};
