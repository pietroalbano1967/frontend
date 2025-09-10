// src/app/components/analytics-dashboard/analytics-dashboard.component.ts
import { Component, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AnalyticsService } from '../../services/analytics.service';
import { MiniTicker } from '../../types/binance.types';

@Component({
  selector: 'app-analytics-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './analytics-dashboard.component.html',
  styleUrls: ['./analytics-dashboard.component.scss']
})
export class AnalyticsDashboardComponent {
  private analyticsService = inject(AnalyticsService);
  
  @Input() tickers: MiniTicker[] = [];

  getAnalyses() {
    return this.analyticsService.getAllAnalyses();
  }

  getTrendIcon(trend: string): string {
    switch (trend) {
      case 'bullish': return '📈';
      case 'bearish': return '📉';
      default: return '➡️';
    }
  }

  getTrendClass(trend: string): string {
    switch (trend) {
      case 'bullish': return 'trend-bullish';
      case 'bearish': return 'trend-bearish';
      default: return 'trend-neutral';
    }
  }
}