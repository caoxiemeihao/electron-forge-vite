import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

import { namedHookWithTaskFn, PluginBase } from '@electron-forge/plugin-base';
import { ForgeMultiHookMap, StartResult } from '@electron-forge/shared-types';
import debug from 'debug';
// eslint-disable-next-line node/no-extraneous-import
import { RollupWatcher } from 'rollup';
import { default as vite } from 'vite';

import { VitePluginConfig } from './Config';
import ViteConfigGenerator from './ViteConfig';

const d = debug('electron-forge:plugin:vite');
const DEFAULT_PORT = 3000;

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

    this.configGenerator = new Promise((resolve) => {
      // eslint-disable-next-line promise/catch-or-return
      vite.resolveConfig({ configFile: this.config.renderer.config }, 'serve').then((resolvedConfig) => {
        // Get the user to set port in vite config file.
        resolve(new ViteConfigGenerator(this.config, this.projectDir, this.isProd, resolvedConfig.server.port ?? DEFAULT_PORT));
        return;
      });
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
      configFile: this.config.main.config,

      // However, bllow config options aways merge into `configFile`.
      build: {
        watch: watch ? {} : null,
        outDir: path.join(this.baseDir, 'main'),
      },
      define: (await this.configGenerator).getDefines(),
    });

    if (watch) {
      this.watchers.push(buildResult as RollupWatcher);
    }
  };

  compileRenderers = async (): Promise<void> => {
    const { config: configFile, entryPoints } = this.config.renderer;

    for (const entry of entryPoints) {
      await vite.build({
        configFile,

        // However, bllow config options aways merge into `configFile`.
        build: {
          outDir: path.join(this.baseDir, 'renderer', entry.name),
          rollupOptions: {
            input: entry.html,
          },
        },
      });
    }

    await this.compilePreload();
  };

  compilePreload = async (watch = false): Promise<void> => {
    await Promise.all(
      this.config.renderer.entryPoints.map(async (entry) => {
        if (entry.preload) {
          const buildResult = await vite.build({
            configFile: this.config.main.config,

            // However, bllow config options aways merge into `configFile`.
            build: {
              lib: {
                entry: entry.preload.js,
                // At present, Electron can only support CommonJs.
                formats: ['cjs'],
                fileName: () => '[name].js',
              },
              watch: watch ? {} : null,
              outDir: path.join(this.baseDir, 'renderer', entry.name),
            },
          });

          if (watch) {
            this.watchers.push(buildResult as RollupWatcher);
          }
        }
      })
    );
  };

  launchRendererDevServers = async (): Promise<void> => {
    const { config: configFile, entryPoints } = this.config.renderer;
    const viteDevServer = await vite.createServer({
      configFile,

      // However, bllow config options aways merge into `configFile`.
      build: {
        rollupOptions: {
          input: entryPoints.map((entry) => entry.html),
        },
      },
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