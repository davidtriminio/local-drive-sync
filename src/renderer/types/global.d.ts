export {};

/**
 * Tipado de la API que el preload inyecta en el renderer vía contextBridge.
 * Debe mantenerse alineado con `Api` de src/shared/ipc-contract.ts.
 */
declare global {
  interface Window {
    api: {
      getAppVersion(): Promise<string>;
    };
  }
}
