## plugin-vite

#### 🚨 This is just a test version of the official plugin `@electron-forge/plugin-vite` and is only intended as a test for the development phase.

This plugin makes it easy to set up standard vite tooling to compile both your main process code and your renderer process code, with built-in support for Hot Module Replacement (HMR) in the renderer process and support for multiple renderers.

```
// forge.config.js

module.exports = {
  plugins: [
    {
      name: 'electron-forge-plugin-vite',
      config: {
        // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
        // If you are familiar with Vite configuration, it will look really familiar.
        build: [
          {
            // `entry` is just an alias for `build.lib.entry` in the `config` counterpart file.
            entry: 'src/main.js',
            config: 'vite.main.config.mjs',
          },
          {
            entry: 'src/preload.js',
            config: 'vite.preload.config.mjs',
          },
        ],
        renderer: [
          {
            name: 'main_window',
            config: 'vite.renderer.config.mjs',
          },
        ],
      },
    },
  ],
}
```