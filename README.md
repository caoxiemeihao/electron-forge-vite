# electron-forge-vite

For test `electron-forge` Vite template.

## Quick Setup


```sh
# npm
npm i -g electron-forge-template-vite-typescript
npm create electron-app my-vite-app --template=vite

# yarn
yarn global add electron-forge-template-vite
yarn create electron-app my-vite-app --template=vite
```

## [🔥 Hot restart](https://github.com/caoxiemeihao/electron-forge-vite/tree/main/plugin)

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
