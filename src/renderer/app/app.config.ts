import { ApplicationConfig } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { routes } from './app.routes';

/**
 * Configuración raíz. Se usa hash location porque en producción la app se
 * sirve vía file:// dentro de Electron.
 */
export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes, withHashLocation())],
};
