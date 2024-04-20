import fs from 'node:fs'
import path from 'node:path'
import { builtinModules } from 'node:module'
import type { AddressInfo } from 'node:net'
import {
  type ConfigEnv,
  type Plugin,
  type UserConfig,
  mergeConfig,
} from 'vite'

function isESModule(packageJson: Record<string, any> = {}) {
  return packageJson.type === 'module'
}

async function getPackageJson(root: string): Promise<Record<string, any> | undefined> {
  const packageJsonPath = path.join(root, 'package.json')
  if (fs.existsSync(packageJsonPath)) {
    try {
      const json = JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf8'))
      return json
    } catch { }
  }
}

async function getExternal(packageJson: Record<string, any> = {}) {
  const builtins = ['electron', ...builtinModules.map((m) => [m, `node:${m}`]).flat()]
  return [...builtins, ...Object.keys(packageJson.dependencies)]
}

function getBuildConfig(env: ConfigEnv<'build'>): UserConfig {
  const { root, mode, command } = env

  return {
    root,
    mode,
    build: {
      // Prevent multiple builds from interfering with each other.
      emptyOutDir: false,
      // 🚧 Multiple builds may conflict.
      outDir: '.vite/build',
      watch: command === 'serve' ? {} : null,
      minify: command === 'build',
      sourcemap: command === 'serve',
    },
    clearScreen: false,
  }
}

function getDefineKeys(names: string[]) {
  const define: { [name: string]: VitePluginRuntimeKeys } = {}

  return names.reduce((acc, name) => {
    const NAME = name.toUpperCase()
    const keys: VitePluginRuntimeKeys = {
      VITE_DEV_SERVER_URL: `${NAME}_VITE_DEV_SERVER_URL`,
      VITE_NAME: `${NAME}_VITE_NAME`,
    }

    return { ...acc, [name]: keys }
  }, define)
}

function getBuildDefine(env: ConfigEnv<'build'>) {
  const { command, forgeConfig } = env
  const names = forgeConfig.renderer.filter(({ name }) => name != null).map(({ name }) => name!)
  const defineKeys = getDefineKeys(names)
  const define = Object.entries(defineKeys).reduce((acc, [name, keys]) => {
    const { VITE_DEV_SERVER_URL, VITE_NAME } = keys
    const def = {
      [VITE_DEV_SERVER_URL]: command === 'serve' ? JSON.stringify(process.env[VITE_DEV_SERVER_URL]) : undefined,
      [VITE_NAME]: JSON.stringify(name),
    }
    return { ...acc, ...def }
  }, {} as Record<string, any>)

  return define
}

function pluginExposeRenderer(name: string): Plugin {
  const { VITE_DEV_SERVER_URL } = getDefineKeys([name])[name]

  return {
    name: '@electron-forge/plugin-vite:expose-renderer',
    configureServer(server) {
      process.viteDevServers ??= {}
      // Expose server for preload scripts hot reload.
      process.viteDevServers[name] = server

      server.httpServer?.once('listening', () => {
        const addressInfo = server.httpServer!.address() as AddressInfo
        // Expose env constant for main process use.
        process.env[VITE_DEV_SERVER_URL] = `http://localhost:${addressInfo?.port}`
      })
    },
  }
}

function pluginHotRestart(command: 'reload' | 'restart'): Plugin {
  return {
    name: '@electron-forge/plugin-vite:hot-restart',
    closeBundle() {
      if (command === 'reload') {
        for (const server of Object.values(process.viteDevServers)) {
          // Preload scripts hot reload.
          server.hot.send({ type: 'full-reload' })
        }
      } else {
        // Main process hot restart.
        // https://github.com/electron/forge/blob/v7.2.0/packages/api/core/src/api/start.ts#L216-L223
        process.stdin.emit('data', 'rs')
      }
    },
  }
}

// --------------

export type MigrationCallback = (config: UserConfig) => void | UserConfig | Promise<void | UserConfig>

function main(env: ConfigEnv, callback?: MigrationCallback): Plugin {
  return {
    name: 'vite-plugin:forge-migration-main',
    async config(_config) {
      const forgeEnv = env as ConfigEnv<'build'>
      const { forgeConfigSelf, root } = forgeEnv
      const define = getBuildDefine(forgeEnv)
      const packageJson = await getPackageJson(root)
      const external = await getExternal(packageJson)
      const esmodule = isESModule(packageJson)
      let config: UserConfig = {
        build: {
          lib: {
            entry: forgeConfigSelf.entry!,
            fileName: () => '[name].js',
            formats: [esmodule ? 'es' : 'cjs'],
          },
          rollupOptions: {
            external,
          },
        },
        // 🚧 Dynamic insertion of plugin, unable to call as expected
        plugins: [pluginHotRestart('restart')],
        define,
        resolve: {
          // Load the Node.js entry.
          mainFields: ['module', 'jsnext:main', 'jsnext'],
        },
      }

      config = mergeConfig(getBuildConfig(forgeEnv), config)
      config = await callback?.(config) ?? config
      return mergeConfig(config, _config)
    },
  }
}

function renderer(env: ConfigEnv, callback?: MigrationCallback): Plugin {
  return {
    name: 'vite-plugin:forge-migration-renderer',
    async config(_config) {
      const forgeEnv = env as ConfigEnv<'renderer'>
      const { root, mode, forgeConfigSelf } = forgeEnv
      const name = forgeConfigSelf.name ?? ''
      let config: UserConfig = {
        root,
        mode,
        base: './',
        build: {
          outDir: `.vite/renderer/${name}`,
        },
        // 🚧 Dynamic insertion of plugin, unable to call as expected
        plugins: [pluginExposeRenderer(name)],
        resolve: {
          preserveSymlinks: true,
        },
        clearScreen: false,
      }

      config = await callback?.(config) ?? config
      return mergeConfig(config, _config)
    },
  }
}

function preload(env: ConfigEnv, callback?: MigrationCallback): Plugin {
  return {
    name: 'vite-plugin:forge-migration-preload',
    async config(_config) {
      const forgeEnv = env as ConfigEnv<'build'>
      const { forgeConfigSelf, root } = forgeEnv
      const packageJson = await getPackageJson(root)
      const external = await getExternal(packageJson)
      const esmodule = isESModule(packageJson)
      const ext = esmodule ? 'mjs' : 'js'
      let config: UserConfig = {
        build: {
          rollupOptions: {
            external,
            // Preload scripts may contain Web assets, so use the `build.rollupOptions.input` instead `build.lib.entry`.
            input: forgeConfigSelf.entry!,
            output: {
              // https://github.com/electron-vite/vite-plugin-electron/blob/v0.28.5/README.md#built-format
              // https://github.com/electron-vite/vite-plugin-electron/blob/v0.28.5/src/simple.ts#L56-L82
              format: 'cjs',
              // It should not be split chunks.
              inlineDynamicImports: true,
              entryFileNames: `[name].${ext}`,
              chunkFileNames: `[name].${ext}`,
              assetFileNames: '[name].[ext]',
            },
          },
        },
        // 🚧 Dynamic insertion of plugin, unable to call as expected
        plugins: [pluginHotRestart('reload')],
      }

      config = mergeConfig(getBuildConfig(forgeEnv), config)
      config = await callback?.(config) ?? config
      return mergeConfig(config, _config)
    },
  }
}

export const to7_3_0 = {
  main,
  renderer,
  preload,
}
