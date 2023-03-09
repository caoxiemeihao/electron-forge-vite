/**
 * Hot restart Electron App.
 */
export function restart(
  /**
   * Custom hot restart behavior.
   */
  callback?: (args: {
    /**
     * Restart the entire Electron App.
     */
    restart: () => void,
    /**
     * Notify the Renderer-Process to reload the page when the Preload-Scripts build is complete,
     * instead of restarting the entire Electron App.
     */
    reload: () => void,
  },
  ) => void): import('vite').Plugin {
  let config: import('vite').ResolvedConfig;

  return {
    name: 'electron-forge-plugin-vite-restart',
    configResolved(_config) {
      config = _config;
    },
    closeBundle() {
      if (config.mode === 'production') {
        // https://github.com/electron/forge/blob/98b621dcace753c1bd33aeb301c64d03335abfdc/packages/plugin/vite/src/ViteConfig.ts#L36-L41
        return;
      }

      if (callback) {
        callback({
          restart: restartElectronApp,
          reload() {
            // TODO: Need to communicate with the Renderer process Vite.
          },
        })
      } else {
        restartElectronApp();
      }
    },
  };
}

function restartElectronApp() {
  // https://github.com/electron/forge/blob/v6.0.5/packages/api/core/src/api/start.ts#L204-L211
  process.stdin.emit('data', 'rs');
}
