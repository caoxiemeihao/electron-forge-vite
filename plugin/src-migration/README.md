## Migration

Migrate to `v7.3.0+` version.

> Why not the Vite plugin? Because dynamically inserting new plugins into the `vite.config.ts` in the plugin does not work!

---

#### Before `vite.main.config.ts`

```js
import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    // Some libs that can run in both Web and Node.js, such as `axios`, we need to tell Vite to build them in Node.js.
    browserField: false,
    conditions: ['node'],
    mainFields: ['module', 'jsnext:main', 'jsnext'],
  },
});
```

#### After `vite.main.config.ts`

```js
import { defineConfig, mergeConfig } from 'vite';
import { to7_3_0_config } from 'electron-forge-plugin-vite/migration';

// https://vitejs.dev/config
export default defineConfig(async (env) => {
  return mergeConfig(
    await to7_3_0_config.main(env),
    {
      resolve: {
        // Some libs that can run in both Web and Node.js, such as `axios`, we need to tell Vite to build them in Node.js.
        browserField: false,
        conditions: ['node'],
        mainFields: ['module', 'jsnext:main', 'jsnext'],
      },
    },
  );
});
```

---

#### Before `vite.renderer.config.ts`

```js
import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({});
```

#### After `vite.renderer.config.ts`

```js
import { defineConfig, mergeConfig } from 'vite';
import { to7_3_0_config } from 'electron-forge-plugin-vite/migration';

// https://vitejs.dev/config
export default defineConfig(async (env) => {
  return mergeConfig(
    await to7_3_0_config.renderer(env),
    {/* You Vite config here... */ },
  );
});
```

---

#### Before `vite.preload.config.ts`

```js
import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({});
```

#### After `vite.preload.config.ts`

```js
import { defineConfig, mergeConfig } from 'vite';
import { to7_3_0_config } from 'electron-forge-plugin-vite/migration';

// https://vitejs.dev/config
export default defineConfig(async (env) => {
  return mergeConfig(
    await to7_3_0_config.preload(env),
    {/* You Vite config here... */ },
  );
});
```
