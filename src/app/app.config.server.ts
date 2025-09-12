// src/app/app.config.server.ts
import { ApplicationConfig } from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideServerRendering } from '@angular/platform-server';
import { routes } from './app.routes';

export const appConfigServer: ApplicationConfig = {
  providers: [
    provideServerRendering(),
    provideRouter(routes),
    provideHttpClient(withFetch()),
    // Provider per identificare ambiente server
    { provide: 'SERVER', useValue: true }
  ],
};