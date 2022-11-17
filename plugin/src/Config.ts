export interface VitePreloadEntryPoint {
  /**
   * Relative or absolute path to the preload JS file.
   */
  js: string;
  /**
   * The optional vite config for your preload process.
   * Defaults to the renderer vite config if blank.
   */
  config?: string;
}

export interface VitePluginEntryPointBase {
  /**
   * Human friendly name of your entry point
   */
  name: string;
}

export interface VitePluginEntryPoint extends VitePluginEntryPointBase {
  /**
   * Relative or absolute path to the HTML template file for this entry point.
   */
  html: string;
  /**
   * Information about the preload script for this entry point. If you don't use
   * preload scripts, you don't need to set this.
   */
  preload?: VitePreloadEntryPoint;
}

export interface VitePluginRendererConfig {
  /**
   * The vite config for your renderer process
   */
  config: string;
  /**
   * Array of entry points, these should map to the windows your app needs to
   * open.  Each window requires it's own entry point
   */
  entryPoints: VitePluginEntryPoint[];
}

export interface VitePluginMainConfig {
  /**
   * The vite config for your main process
   */
  config: string;
}

export interface VitePluginConfig {
  main: VitePluginMainConfig;
  renderer: VitePluginRendererConfig;
}
