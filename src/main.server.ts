// src/main.server.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfigServer } from './app/app.config.server';

const bootstrap = () => bootstrapApplication(AppComponent, appConfigServer);
export default bootstrap;
