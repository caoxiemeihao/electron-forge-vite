import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

import { namedHookWithTaskFn, PluginBase } from '@electron-forge/plugin-base';
import { ForgeMultiHookMap, StartResult } from '@electron-forge/shared-types';
import debug from 'debug';
// eslint-disable-next-line node/no-extraneous-import
import { RollupWatcher } from 'rollup';
import { loadConfigFromFile, default as vite } from 'vite';

import { VitePluginConfig } from './Config';
import ViteConfigGenerator from './ViteConfig';

const d = debug('electron-forge:plugin:vite');
const VITE_DEV_SERVER_PORT = 5173;

export default class VitePlugin extends PluginBase<VitePluginConfig> {
  name = 'vite';

  private isProd = false;

  // The root of the Electron app
  private projectDir!: string;

  // Where the Vite output is generated. Usually `${projectDir}/.vite`
  private baseDir!: string;

  private configGenerator: Promise<ViteConfigGenerator>;

  private watchers: RollupWatcher[] = [];

  private servers: http.Server[] = [];

  constructor(c: VitePluginConfig) {
    super(c);

    this.configGenerator = new Promise((resolve, reject) => {
      loadConfigFromFile({ command: 'serve', mode: 'development' }, this.config.renderer.config)
        .then((loadResult) => {
          // Get the user to set port in Vite config file.
          resolve(new ViteConfigGenerator(this.config, this.projectDir, this.isProd, loadResult?.config.server?.port ?? VITE_DEV_SERVER_PORT));
          return;
        })
        .catch(reject);
    });
  }

  init = (dir: string): void => {
    this.setDirectories(dir);

    d('hooking process events');
    process.on('exit', (_code) => this.exitHandler({ cleanup: true }));
    process.on('SIGINT' as NodeJS.Signals, (_signal) => this.exitHandler({ exit: true }));
  };

  setDirectories = (dir: string): void => {
    this.projectDir = dir;
    this.baseDir = path.resolve(dir, '.vite');
  };

  getHooks = (): ForgeMultiHookMap => {
    return {
      prePackage: [
        namedHookWithTaskFn<'prePackage'>(async () => {
          this.isProd = true;
          fs.rmSync(this.baseDir, { recursive: true, force: true });

          await this.compileMain();
          await this.compileRenderers();
        }, 'Building vite bundles'),
      ],
    };
  };

  private alreadyStarted = false;
  startLogic = async (): Promise<StartResult> => {
    if (this.alreadyStarted) return false;
    this.alreadyStarted = true;

    fs.rmSync(this.baseDir, { recursive: true, force: true });

    return {
      tasks: [
        {
          title: 'Compiling main process code',
          task: async () => {
            await this.compileMain(true);
          },
          options: {
            showTimer: true,
          },
        },
        {
          title: 'Launching dev servers for renderer process code',
          task: async () => {
            await this.launchRendererDevServers();
          },
          options: {
            persistentOutput: true,
            showTimer: true,
          },
        },
      ],
      result: false,
    };
  };

  compileMain = async (watch = false): Promise<void> => {
    const buildResult = await vite.build({
      // Avoid recursive builds caused by users configuring @electron-forge/plugin-vite in Vite config file.
      configFile: false,
      ...(await (await this.configGenerator).getMainConfig(watch)),
    });

    if (watch) {
      this.watchers.push(buildResult as RollupWatcher);
    }
  };

  compileRenderers = async (): Promise<void> => {
    if (!this.config.renderer?.config) {
      throw new Error('Required option "renderer.config" has not been defined');
    }
    const { entryPoints } = this.config.renderer;

    for (const entry of entryPoints) {
      // Build each EntryPoint separately to ensure they can be built to different subfolders. 🤔
      await vite.build(await (await this.configGenerator).getRendererConfig(entry));
    }

    await this.compilePreload();
  };

  compilePreload = async (watch = false): Promise<void> => {
    await Promise.all(
      this.config.renderer.entryPoints.map(async (entry) => {
        if (entry.preload?.js) {
          const buildResult = await vite.build({
            configFile: false,
            ...(await (await this.configGenerator).getPreloadConfigForEntryPoint(entry, watch)),
          });

          if (watch) {
            this.watchers.push(buildResult as RollupWatcher);
          }
        }
      })
    );
  };

  launchRendererDevServers = async (): Promise<void> => {
    const { config: configFile } = this.config.renderer;
    const viteDevServer = await vite.createServer({
      configFile,
      // TODO: Support for working in the `vite serve` phase.
      // `input` only works in `vite build`, which is not compatible with the user-configured `html` entry.
      // build: {
      //   rollupOptions: {
      //     input: entryPoints.map((entry) => entry.html),
      //   },
      // },
    });

    await viteDevServer.listen();
    viteDevServer.printUrls();

    if (viteDevServer.httpServer) {
      this.servers.push(viteDevServer.httpServer);
    }

    await this.compilePreload(true);
  };

  exitHandler = (options: { cleanup?: boolean; exit?: boolean }, err?: Error): void => {
    d('handling process exit with:', options);
    if (options.cleanup) {
      for (const watcher of this.watchers) {
        d('cleaning vite watcher');
        watcher.close();
      }
      this.watchers = [];
      for (const server of this.servers) {
        d('cleaning http server');
        server.close();
      }
      this.servers = [];
    }
    if (err) console.error(err.stack);
    // Why: This is literally what the option says to do.
    // eslint-disable-next-line no-process-exit
    if (options.exit) process.exit();
  };
}

export { VitePlugin };
