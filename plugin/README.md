
> **Since [Electron Forge v6.1.1](https://github.com/electron/forge/releases/tag/v6.1.1) started supporting Vite.**

```tree
├─┬ plugin
│ │
│ ├─┬ src
│ │ ├── util/
│ │ └── VitePlugin.ts  `electron-forge-plugin-vite`
│ │
│ ├─┬ src-migration
│ │ └── index.ts       `electron-forge-plugin-vite/migration`
│ │
│ └─┬ src-plugin
│   └── index.ts       `electron-forge-plugin-vite/plugin`
│
```

---

# electron-forge-plugin-vite

For test `electron-forge` Vite template.

> 🚨 This is just a test version of the official plugin `@electron-forge/plugin-vite` and is only intended as a test for the development phase.

## Quick Setup

```sh
# npm
npm i -g electron-forge-template-vite-typescript
npm create electron-app my-vite-app --template=vite-typescript

# yarn
yarn global add electron-forge-template-vite-typescript
yarn create electron-app my-vite-app --template=vite-typescript
```

## 🔥 Hot restart

> electron-forge-plugin-vite@0.4.0+

```js
// vite.main.config.mjs    - For Electron Main
// vite.preload.config.mjs - For Preload Scripts

import { defineConfig } from 'vite';
import { restart } from 'electron-forge-plugin-vite/plugin';

// https://vitejs.dev/config
export default defineConfig({
  plugins: [restart()],
});
```

<!--

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
            // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
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
};
```
-->

## Migration

Migrate to `v7.3.0+` version.

> Why not the Vite plugin? Because dynamically inserting new plugins into the `vite.config.ts` in the plugin does not work!

---

#### `vite.main.config.ts`

```diff
  import { defineConfig } from 'vite';
+ import { forgeViteConfig } from 'electron-forge-plugin-vite/migration';

  // https://vitejs.dev/config
- export default defineConfig({
+ export default defineConfig(forgeViteConfig.main({
    resolve: {
      // Some libs that can run in both Web and Node.js, such as `axios`, we need to tell Vite to build them in Node.js.
      browserField: false,
      conditions: ['node'],
      mainFields: ['module', 'jsnext:main', 'jsnext'],
    },
- });
+ }));
```

#### `vite.renderer.config.ts`

```diff
  import { defineConfig } from 'vite';
+ import { forgeViteConfig } from 'electron-forge-plugin-vite/migration';

  // https://vitejs.dev/config
- export default defineConfig({});
+ export default defineConfig(forgeViteConfig.renderer({}));
```

---

#### `vite.preload.config.ts`

```diff
  import { defineConfig } from 'vite';
+ import { forgeViteConfig } from 'electron-forge-plugin-vite/migration';

  // https://vitejs.dev/config
- export default defineConfig({});
+ export default defineConfig(forgeViteConfig.preload({}));
```
