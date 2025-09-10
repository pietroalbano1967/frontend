import { 
  Component, 
  Input, 
  Output, 
  EventEmitter, 
  inject, 
  computed, 
  signal,
  OnChanges,
  SimpleChanges 
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MiniTicker } from '../../types/binance.types';
import { AlertService, PriceAlert } from '../../services/alert.service';

@Component({
  selector: 'app-mini-ticker-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mini-ticker-table.component.html',
  styleUrls: ['./mini-ticker-table.component.scss']
})
export class MiniTickerTableComponent implements OnChanges {
  private alertService = inject(AlertService);
  
  // Input come signal per la reattività
  private _tickers = signal<MiniTicker[]>([]);
  
  @Input() 
  set tickers(value: MiniTicker[]) {
    this._tickers.set(value || []);
  }
  get tickers(): MiniTicker[] {
    return this._tickers();
  }
  
  @Input() title: string = 'MiniTicker Data';
  @Output() tickerSelect = new EventEmitter<MiniTicker>();

  // Segnali per lo stato interno
  sortField = signal<string>('symbol');
  sortDirection = signal<'asc' | 'desc'>('asc');

  // Computed properties reattive
  activeAlerts = computed(() => {
    const alerts = this.alertService.getAlerts()();
    const alertMap = new Map<string, { above: number[]; below: number[] }>();
    
    alerts.forEach((alert: PriceAlert) => {
      if (alert.active && !alert.triggered) {
        const symbol = alert.symbol.toLowerCase();
        
        if (!alertMap.has(symbol)) {
          alertMap.set(symbol, { above: [], below: [] });
        }
        
        const symbolAlerts = alertMap.get(symbol)!;
        if (alert.condition === 'above') {
          symbolAlerts.above.push(alert.price);
        } else {
          symbolAlerts.below.push(alert.price);
        }
        
        // Ordina i prezzi
        symbolAlerts.above.sort((a, b) => a - b);
        symbolAlerts.below.sort((a, b) => a - b);
      }
    });
    
    return alertMap;
  });

  // Computed reattivo che dipende da _tickers signal
  sortedTickers = computed(() => {
    const field = this.sortField();
    const direction = this.sortDirection();
    const tickers = this._tickers(); // Usa il signal interno
    
    if (!tickers || tickers.length === 0) {
      return [];
    }
    
    return [...tickers].sort((a, b) => {
      let valueA: any, valueB: any;

      switch (field) {
        case 'symbol':
          valueA = a.symbol; 
          valueB = b.symbol; 
          break;
        case 'last_price':
          valueA = a.last_price; 
          valueB = b.last_price; 
          break;
        case 'high_price':
          valueA = a.high_price; 
          valueB = b.high_price; 
          break;
        case 'low_price':
          valueA = a.low_price; 
          valueB = b.low_price; 
          break;
        case 'volume':
          valueA = a.volume; 
          valueB = b.volume; 
          break;
        case 'event_time':
          valueA = a.event_time; 
          valueB = b.event_time; 
          break;
        default:
          valueA = a.symbol; 
          valueB = b.symbol;
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
  });

  // Getter per il template
  get sortedTickersArray(): MiniTicker[] {
    return this.sortedTickers();
  }

  get activeAlertsMap(): Map<string, { above: number[]; below: number[] }> {
    return this.activeAlerts();
  }

 ngOnChanges(changes: SimpleChanges) {
    if (changes['tickers']) {
      this._tickers.set(this.tickers);
      
      // Se i ticker sono vuoti, resetta l'ordinamento
      if (this.tickers.length === 0) {
        this.sortField.set('symbol');
        this.sortDirection.set('asc');
      }
    }
  }


  onTickerClick(ticker: MiniTicker) {
    this.tickerSelect.emit(ticker);
  }

  onSort(field: string) {
    if (this.sortField() === field) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortField.set(field);
      this.sortDirection.set('asc');
    }
  }

  getSortIcon(field: string): string {
    if (this.sortField() !== field) return '↕️';
    return this.sortDirection() === 'asc' ? '↑' : '↓';
  }

  getPriceChange(ticker: MiniTicker): number {
    const midPrice = (ticker.high_price + ticker.low_price) / 2;
    return ticker.last_price - midPrice;
  }

  getPriceChangePercent(ticker: MiniTicker): number {
    const midPrice = (ticker.high_price + ticker.low_price) / 2;
    return midPrice !== 0 ? ((ticker.last_price - midPrice) / midPrice) * 100 : 0;
  }

  getAlertsForSymbol(symbol: string): { above: number[]; below: number[] } {
    return this.activeAlertsMap.get(symbol.toLowerCase()) || { above: [], below: [] };
  }

  hasAlerts(symbol: string): boolean {
    const alerts = this.getAlertsForSymbol(symbol);
    return alerts.above.length > 0 || alerts.below.length > 0;
  }

  formatAlertTooltip(alerts: { above: number[]; below: number[] }): string {
    const parts = [];
    
    if (alerts.above.length > 0) {
      parts.push(`Above: ${alerts.above.map(p => `$${p.toFixed(2)}`).join(', ')}`);
    }
    
    if (alerts.below.length > 0) {
      parts.push(`Below: ${alerts.below.map(p => `$${p.toFixed(2)}`).join(', ')}`);
    }
    
    return parts.join('\n');
  }
}