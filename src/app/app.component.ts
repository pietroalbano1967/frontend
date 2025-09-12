// app.component.ts - VERSIONE CORRETTA
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { TradingDashboardComponent } from './components/trading-dashboard/trading-dashboard.component';
import { TradingSimulatorComponent } from './components/trading-simulator/trading-simulator.component';
import { NotificationCenterComponent } from './components/notification-center/notification-center.component';
import { CurrencyPipe, PercentPipe } from '@angular/common';
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    DashboardComponent,
    TradingDashboardComponent,
    TradingSimulatorComponent,
    NotificationCenterComponent,
    CurrencyPipe,
    PercentPipe
  ],
  template: `
    <div class="app-container">
      <header class="app-header">
        <h1>📊 Trading Intelligence Platform</h1>
        <p>Piattaforma avanzata di trading con simulatore integrato</p>
      </header>

      <main class="app-main">
        <app-trading-simulator></app-trading-simulator>
        
        <div class="main-content">
          <app-dashboard></app-dashboard>
          <app-trading-dashboard></app-trading-dashboard>
        </div>
      </main>

      <app-notification-center></app-notification-center>
    </div>
  `,
  styles: [`
    .app-container {
      min-height: 100vh;
      background: #f8f9fa;
    }

    .app-header {
      background: white;
      padding: 20px;
      border-bottom: 1px solid #e9ecef;
      text-align: center;
    }

    .app-header h1 {
      margin: 0 0 8px 0;
      color: #2c3e50;
    }

    .app-header p {
      margin: 0;
      color: #6c757d;
    }

    .app-main {
      padding: 20px;
      max-width: 1400px;
      margin: 0 auto;
    }

    .main-content {
      display: grid;
      gap: 20px;
      margin-top: 20px;
    }
  `]
})
export class AppComponent {
  title = 'trading-platform';
}