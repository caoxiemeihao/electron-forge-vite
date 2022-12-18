export interface VitePluginBuildConfig {
  /**
   * Alias of `build.lib.entry` in `config`.
   */
  entry?: import('vite').LibraryOptions['entry'];
  /**
   * Vite config file path.
   */
  config?: string;
}

export interface VitePluginConfig {
  /**
   * Build anything such as Main process, Preload scripts and Worker process, etc.
   */
  build: VitePluginBuildConfig[];
  /**
   * Vite's CLI Options, for serve and build.
   * @see https://vitejs.dev/guide/cli.html
   */
  CLIOptions?: Record<string, any>;
}
