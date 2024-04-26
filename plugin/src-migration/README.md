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
