import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MiniTicker } from '../../types/binance.types';
import { AlertService } from '../../services/alert.service';
import { PriceAlert } from '../../services/alert.service';

@Component({
  selector: 'app-mini-ticker-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mini-ticker-table.component.html',
  styleUrls: ['./mini-ticker-table.component.scss']
})
export class MiniTickerTableComponent implements OnChanges {
  @Input() tickers: MiniTicker[] = [];
  @Input() title: string = 'MiniTicker Data';

  sortedTickers: MiniTicker[] = [];
  sortField: string = 'symbol';
  sortDirection: 'asc' | 'desc' = 'asc';
  
  // Cambia la struttura per memorizzare i prezzi degli alert
  activeAlerts: Map<string, {above: number[], below: number[]}> = new Map();

  constructor(private alertService: AlertService) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['tickers']) {
      this.sortTickers(this.sortField, this.sortDirection);
      this.updateActiveAlerts();
    }
  }

  private updateActiveAlerts() {
    const alerts: PriceAlert[] = this.alertService.getAlerts()();
    this.activeAlerts.clear();
    
    alerts.forEach((alert: PriceAlert) => {
      if (alert.active && !alert.triggered) {
        const symbol = alert.symbol.toLowerCase();
        
        if (!this.activeAlerts.has(symbol)) {
          this.activeAlerts.set(symbol, { above: [], below: [] });
        }
        
        const symbolAlerts = this.activeAlerts.get(symbol)!;
        if (alert.condition === 'above') {
          symbolAlerts.above.push(alert.price);
        } else {
          symbolAlerts.below.push(alert.price);
        }
        
        // Ordina i prezzi per una migliore visualizzazione
        symbolAlerts.above.sort((a, b) => a - b);
        symbolAlerts.below.sort((a, b) => a - b);
      }
    });
  }

  sortTickers(field: string, direction: 'asc' | 'desc' = 'asc') {
    this.sortField = field;
    this.sortDirection = direction;

    this.sortedTickers = [...this.tickers].sort((a, b) => {
      let valueA: any, valueB: any;

      switch (field) {
        case 'symbol':
          valueA = a.symbol; valueB = b.symbol; break;
        case 'last_price':
          valueA = a.last_price; valueB = b.last_price; break;
        case 'high_price':
          valueA = a.high_price; valueB = b.high_price; break;
        case 'low_price':
          valueA = a.low_price; valueB = b.low_price; break;
        case 'volume':
          valueA = a.volume; valueB = b.volume; break;
        case 'event_time':
          valueA = a.event_time; valueB = b.event_time; break;
        default:
          valueA = a.symbol; valueB = b.symbol;
      }

      if (typeof valueA === 'string') {
        return direction === 'asc'
          ? valueA.localeCompare(valueB)
          : valueB.localeCompare(valueA);
      } else {
        return direction === 'asc'
          ? valueA - valueB
          : valueB - valueA;
      }
    });
  }

  onSort(field: string) {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortDirection = 'asc';
    }
    this.sortTickers(field, this.sortDirection);
  }

  getSortIcon(field: string): string {
    if (this.sortField !== field) return '↕️';
    return this.sortDirection === 'asc' ? '↑' : '↓';
  }

  getPriceChange(ticker: MiniTicker): number {
    const midPrice = (ticker.high_price + ticker.low_price) / 2;
    return ticker.last_price - midPrice;
  }

  getPriceChangePercent(ticker: MiniTicker): number {
    const midPrice = (ticker.high_price + ticker.low_price) / 2;
    return midPrice !== 0 ? ((ticker.last_price - midPrice) / midPrice) * 100 : 0;
  }

    getAlertsForSymbol(symbol: string): {above: number[], below: number[]} {
    return this.activeAlerts.get(symbol.toLowerCase()) || { above: [], below: [] };
  }

  // Nuovo metodo per formattare i prezzi degli alert
  formatAlertPrices(alerts: {above: number[], below: number[]}): string {
    const parts = [];
    
    if (alerts.above.length > 0) {
      const abovePrices = alerts.above.map(price => `↑$${price.toFixed(2)}`).join(' ');
      parts.push(abovePrices);
    }
    
    if (alerts.below.length > 0) {
      const belowPrices = alerts.below.map(price => `↓$${price.toFixed(2)}`).join(' ');
      parts.push(belowPrices);
    }
    
    return parts.join(' ');
  }

  // Metodo per verificare se ci sono alert per un simbolo
  hasAlerts(symbol: string): boolean {
    const alerts = this.getAlertsForSymbol(symbol);
    return alerts.above.length > 0 || alerts.below.length > 0;
  }
}
