// analytics-dashboard.component.ts - VERSIONE CORRETTA
import { Component, inject, Input, OnChanges, ChangeDetectorRef, SimpleChanges, signal, computed, effect } from '@angular/core';
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
export class AnalyticsDashboardComponent implements OnChanges {
  private analyticsService = inject(AnalyticsService);
  private cdr = inject(ChangeDetectorRef);

  @Input() tickers: MiniTicker[] = [];
  @Input() selectedSymbol: string = '';

  // Signals per gestire lo stato
  isLoading = signal(false);
  private refreshTrigger = signal(0);

  // Computed property reattiva per le analisi
  analyses = computed(() => {
    // Trigger per forzare l'aggiornamento
    this.refreshTrigger();
    
    const allAnalyses = this.analyticsService.getAllAnalyses();
    
    if (this.selectedSymbol) {
      return allAnalyses.filter(analysis => 
        analysis.symbol.toLowerCase() === this.selectedSymbol.toLowerCase()
      );
    } else {
      return allAnalyses;
    }
  });

  // Effect per reagire ai cambiamenti delle analisi
  private analysisEffect = effect(() => {
    this.analyses(); // Forza l'aggiornamento
    this.cdr.detectChanges();
  });

  ngOnChanges(changes: SimpleChanges) {
    if (changes['selectedSymbol'] || changes['tickers']) {
      this.refreshAnalyses();
    }
  }

  // Metodo per aggiornare le analisi
  updateAnalyses() {
    this.isLoading.set(true);
    
    // Forza il refresh delle analisi
    this.refreshTrigger.set(Date.now());
    
    setTimeout(() => {
      this.isLoading.set(false);
      this.cdr.detectChanges();
    }, 100);
  }

  // Metodo per refresh completo
  refreshAnalyses() {
    this.analyticsService.refreshAnalyses();
    this.updateAnalyses();
  }

  getAnalyses() {
    return this.analyses();
  }

  getTrendIcon(trend: string): string {
    switch (trend) {
      case 'bullish': return '📈';
      case 'bearish': return '📉';
      case 'neutral': return '➡️';
      default: return '🔍';
    }
  }

  getTrendClass(trend: string): string {
    switch (trend) {
      case 'bullish': return 'trend-bullish';
      case 'bearish': return 'trend-bearish';
      case 'neutral': return 'trend-neutral';
      default: return '';
    }
  }

  getStrengthClass(strength: number): string {
    if (!strength) return 'strength-unknown';
    if (strength >= 80) return 'strength-strong';
    if (strength >= 60) return 'strength-medium';
    if (strength >= 40) return 'strength-weak';
    return 'strength-very-weak';
  }
}