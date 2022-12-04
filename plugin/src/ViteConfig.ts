import path from 'node:path';

import debug from 'debug';
import { BuildOptions, ConfigEnv, loadConfigFromFile, UserConfig } from 'vite';

import { VitePluginConfig, VitePluginEntryPoint } from './Config';
import { externalBuiltins } from './util/plugins';

type ViteMode = 'production' | 'development';

const d = debug('electron-forge:plugin:vite:viteconfig');

export default class ViteConfigGenerator {
  private isProd: boolean;

  private pluginConfig: VitePluginConfig;

  private port: number;

  private projectDir!: string;

  private baseDir!: string;

  constructor(pluginConfig: VitePluginConfig, projectDir: string, isProd: boolean, port: number) {
    this.pluginConfig = pluginConfig;
    this.projectDir = projectDir;
    this.baseDir = path.resolve(projectDir, '.vite');
    this.isProd = isProd;
    this.port = port;

    d('Config mode:', this.mode);
  }

  async resolveConfig(config: string, configEnv: Partial<ConfigEnv> = {}) {
    configEnv.command ??= 'build'; // should always build.
    configEnv.mode ??= this.mode;
    return loadConfigFromFile(configEnv as ConfigEnv, config);
  }

  get mode(): ViteMode {
    return this.isProd ? 'production' : 'development';
  }

  private rendererEntryPoint(entryPoint: VitePluginEntryPoint, inRendererDir: boolean, basename: string): string {
    if (this.isProd) {
      return `\`file://$\{require('path').resolve(__dirname, '..', '${inRendererDir ? 'renderer' : '.'}', '${entryPoint.name}', '${basename}')}\``;
    }
    const baseUrl = `http://localhost:${this.port}/${entryPoint.name}`;
    if (basename !== 'index.html') {
      return `'${baseUrl}/${basename}'`;
    }
    return `'${baseUrl}'`;
  }

  getDefines(inRendererDir = true): Record<string, string> {
    const defines: Record<string, string> = {};
    if (!this.pluginConfig.renderer.entryPoints || !Array.isArray(this.pluginConfig.renderer.entryPoints)) {
      throw new Error('Required config option "renderer.entryPoints" has not been defined');
    }
    for (const entryPoint of this.pluginConfig.renderer.entryPoints) {
      const entryKey = this.toEnvironmentVariable(entryPoint);
      // Vite uses html files as the entry point, so the html file is always present.
      defines[entryKey] = this.rendererEntryPoint(entryPoint, inRendererDir, 'index.html');
      defines[`process.env.${entryKey}`] = defines[entryKey];

      const preloadDefineKey = this.toEnvironmentVariable(entryPoint, true);
      defines[preloadDefineKey] = this.getPreloadDefine(entryPoint);
      defines[`process.env.${preloadDefineKey}`] = defines[preloadDefineKey];
    }

    return defines;
  }

  async getMainConfig(watch = false): Promise<UserConfig> {
    if (!this.pluginConfig.main.config) {
      throw new Error('Required option "main.config" has not been defined');
    }

    const loadResult = await this.resolveConfig(this.pluginConfig.main.config)!;
    const { build: userBuild, define: userDefine, plugins = [], ...userConfig } = loadResult!.config;
    const build: BuildOptions = {
      emptyOutDir: false,
      outDir: path.join(this.baseDir, 'main'),
      watch: watch ? {} : null,
      // User Configuration First Priority.
      ...userBuild,
    };
    const define = { ...this.getDefines(), ...userDefine };

    return <UserConfig>{
      ...userConfig,
      build,
      define,
      plugins: plugins.concat(externalBuiltins()),
    };
  }

  async getRendererConfig(entryPoint: VitePluginEntryPoint): Promise<UserConfig> {
    const loadResult = await this.resolveConfig(this.pluginConfig.renderer.config)!;
    const { build: userBuild, ...userConfig } = loadResult!.config;
    const build: BuildOptions = {
      outDir: path.join(this.baseDir, 'renderer', entryPoint.name),
      // rollupOptions: {
      //   input: entry.html,
      // },
      emptyOutDir: false,
      ...userBuild,
    };

    return <UserConfig>{
      build,
      ...userConfig,
    };
  }

  async getPreloadConfigForEntryPoint(entryPoint: VitePluginEntryPoint, watch = false): Promise<UserConfig> {
    let config: UserConfig = {};
    if (!entryPoint.preload?.js) {
      return config;
    }
    if (entryPoint.preload?.config) {
      config = (await this.resolveConfig(entryPoint.preload.config))!.config;
    }

    const { build: userBuild, plugins = [], ...userConfig } = config;
    const build: BuildOptions = {
      emptyOutDir: false,
      lib: {
        entry: entryPoint.preload.js,
        // At present, Electron can only support CommonJs.
        formats: ['cjs'],
        fileName: () => '[name].js',
      },
      outDir: path.join(this.baseDir, 'renderer', entryPoint.name),
      watch: watch ? {} : null,
      ...userBuild,
    };

    return <UserConfig>{
      ...userConfig,
      build,
      plugins: plugins.concat(externalBuiltins()),
    };
  }

  private toEnvironmentVariable(entryPoint: VitePluginEntryPoint, preload = false): string {
    const suffix = preload ? '_PRELOAD_VITE_ENTRY' : '_VITE_ENTRY';
    return `${entryPoint.name.toUpperCase().replace(/ /g, '_')}${suffix}`;
  }

  private getPreloadDefine(entryPoint: VitePluginEntryPoint): string {
    if (entryPoint.preload?.js) {
      if (this.isProd) {
        return `require('path').resolve(__dirname, '../renderer', '${entryPoint.name}', 'preload.js')`;
      }
      return `'${path.resolve(this.baseDir, 'renderer', entryPoint.name, 'preload.js').replace(/\\/g, '\\\\')}'`;
    } else {
      // If this entry-point has no configured preload script just map this constant to `undefined`
      // so that any code using it still works.  This makes quick-start / docs simpler.
      return 'undefined';
    }
  }
}
