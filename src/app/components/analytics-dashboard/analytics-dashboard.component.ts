import { Component, inject, Input, OnChanges, ChangeDetectorRef,SimpleChanges, signal, computed } from '@angular/core';
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
   private cdr = inject(ChangeDetectorRef); // Aggiungi questo

  @Input() tickers: MiniTicker[] = [];
  @Input() selectedSymbol: string = '';

  // Usa signals per una migliore reattività
  isLoading = signal(true);
  filteredAnalyses = signal<any[]>([]);

  // Computed property per le analisi
  analyses = computed(() => {
    const allAnalyses = this.analyticsService.getAllAnalyses();
    
    if (this.selectedSymbol) {
      // Filtra per simbolo selezionato
      return allAnalyses.filter(analysis => 
        analysis.symbol.toLowerCase() === this.selectedSymbol.toLowerCase()
      );
    } else {
      // Mostra tutte le analisi
      return allAnalyses;
    }
  });

  ngOnChanges(changes: SimpleChanges) {
    if (changes['selectedSymbol'] || changes['tickers']) {
      this.updateFilteredAnalyses();
    }
  }

  private updateFilteredAnalyses() {
    this.isLoading.set(true);
    
    setTimeout(() => {
      this.filteredAnalyses.set(this.analyses());
      this.isLoading.set(false);
    }, 100);
  }

  getAnalyses() {
    return this.filteredAnalyses();
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
    if (strength >= 80) return 'strength-strong';
    if (strength >= 60) return 'strength-medium';
    if (strength >= 40) return 'strength-weak';
    return 'strength-very-weak';
  }

  getAnalysisForSymbol(symbol: string): any {
    return this.filteredAnalyses().find(analysis => 
      analysis.symbol.toLowerCase() === symbol.toLowerCase()
    );
  }

  hasAnalyses(): boolean {
    return this.filteredAnalyses().length > 0;
  }

  refreshAnalyses() {
    this.analyticsService.refreshAnalyses();
    this.updateFilteredAnalyses();
  }

  // Nuovo metodo per gestire il caso senza analisi
  getNoAnalysesMessage(): string {
    if (this.selectedSymbol) {
      return `Nessuna analisi disponibile per ${this.selectedSymbol.toUpperCase()}`;
    }
    return 'Nessuna analisi disponibile. Seleziona dei simboli per vedere le analisi.';
  }

  // Metodo per ottenere il numero totale di analisi
  getTotalAnalysesCount(): number {
    return this.filteredAnalyses().length;
  }

  // Metodo per ottenere analisi per trend
  getAnalysesByTrend(trend: string): any[] {
    return this.filteredAnalyses().filter(analysis => analysis.trend === trend);
  }
  
  updateAnalyses() {
    this.isLoading.set(true);
    
    setTimeout(() => {
      this.filteredAnalyses.set(this.analyses());
      this.isLoading.set(false);
      
      // Forza il change detection
      this.cdr.detectChanges();
    }, 100);
  }

}