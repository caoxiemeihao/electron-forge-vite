## plugin-vite

This plugin makes it easy to set up standard vite tooling to compile both your main process code and your renderer process code, with built-in support for Hot Module Replacement (HMR) in the renderer process and support for multiple renderers.

```
// forge.config.js

module.exports = {
  plugins: [
    {
      name: 'electron-forge-plugin-vite',
      config: {
        main: {
          config: './vite.main.config.js',
        },
        renderer: {
          config: './vite.renderer.config.js',
          entryPoints: [
            {
              html: './src/index.html',
              name: 'main_window',
              preload: {
                js: './src/preload.js',
              },
            },
          ],
        },
      },
    },
  ],
}
```