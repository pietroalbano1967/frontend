import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `
    <main class="container">
      <h1 class="title">Binance Bot Dashboard</h1>
      <router-outlet></router-outlet>
    </main>
  `,
  styles: [`
    .container {
      font-family: Arial, sans-serif;
      padding: 1rem;
    }
    .title {
      font-size: 1.5rem;
      margin-bottom: 1rem;
      color: #1976d2;
    }
  `]
})
export class AppComponent {}
