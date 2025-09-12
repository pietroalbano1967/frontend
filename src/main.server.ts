// src/main.server.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfigServer } from './app/app.config.server';

const bootstrap = (): Promise<any> => {
  console.log('🚀 Avvio bootstrap SSR...');
  
  return new Promise((resolve, reject) => {
    // Delay per stabilizzare il rendering in SSR
    setTimeout(() => {
      try {
        const app = bootstrapApplication(AppComponent, appConfigServer);
        console.log('✅ Bootstrap SSR completato con successo');
        resolve(app);
      } catch (error) {
        console.error('❌ Bootstrap SSR fallito:', error);
        reject(error);
      }
    }, 500); // 500ms delay
  });
};

// Export per CommonEngine
export default bootstrap;