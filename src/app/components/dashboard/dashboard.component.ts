import { Component, OnInit, OnDestroy, signal, inject, Inject, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { MiniTicker, WebSocketMessage } from './../../types/binance.types';
import { BinanceApiService } from '../../services/binance-api.service';
import { PriceChartComponent } from '../chart/chart.component';
import { AlertManagerComponent } from '../alert-manager/alert-manager.component';
import { AlertService } from '../../services/alert.service';
import { SymbolSelectorComponent } from '../symbol-selector/symbol-selector.component';
import { MiniTickerTableComponent } from '../mini-ticker-table/mini-ticker-table.component';
import { AnalyticsService } from '../../services/analytics.service';
import { NotificationService } from '../../services/notification.service';
import { AnalyticsDashboardComponent } from '../analytics-dashboard/analytics-dashboard.component';
import { NotificationCenterComponent } from '../notification-center/notification-center.component';
const MAX_CHARTS = 2;

@Component({
  standalone: true,
  selector: 'app-dashboard',
  imports: [
    CommonModule,
    HttpClientModule,
    FormsModule,
    PriceChartComponent,
    AlertManagerComponent,
    SymbolSelectorComponent,
    MiniTickerTableComponent,
    NotificationCenterComponent,    // Aggiungi questa riga
    AnalyticsDashboardComponent     // Aggiungi questa riga
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  private api = inject(BinanceApiService);
  private alertService = inject(AlertService);
  private analyticsService = inject(AnalyticsService);
  private notificationService = inject(NotificationService);
  private cdr = inject(ChangeDetectorRef);
  private isBrowser: boolean;

  symbolsInput = 'btcusdt,ethusdt';
  wsOpen = false;
  isConnecting = false;
  lastMsg: WebSocketMessage | null = null;
  messagesReceived = 0;
  lastUpdate: Date | null = null;
  miniTickers = signal<MiniTicker[]>([]);
  chartLabels = signal<string[]>([]);
  priceHistory = signal<Record<string, number[]>>({});
  selectedTicker: string = '';
  showAllAnalytics: boolean = false;
  private wsSubscription: Subscription | null = null;
  private subscriptions: Subscription[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimer: any = null;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit() {
    this.refresh();
    this.requestNotificationPermission();
  }

  ngOnDestroy() {
    this.stop();
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
  }

  private requestNotificationPermission(): void {
    if (this.isBrowser && 'Notification' in window) {
      this.notificationService.requestNotificationPermission();
    }
  }

  private selectedSymbolsArr(): string[] {
    return (this.symbolsInput || '')
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);
  }

  chartSymbols(): string[] {
    return this.selectedSymbolsArr().slice(0, MAX_CHARTS);
  }

  private wsSymbols(): string[] {
    return this.selectedSymbolsArr();
  }

  start() {
    this.startWebSocket();
  }
// Aggiungi questo metodo
  onClearAll() {
    this.symbolsInput = '';
    this.selectedTicker = '';
    this.analyticsSymbol = '';
    this.showAllAnalytics = false;
    this.miniTickers.set([]);
    this.chartLabels.set([]);
    this.priceHistory.set({});
    this.stop(); // Disconnetti il WebSocket
    this.clearFeed();
  }
  private startWebSocket() {
    const wsList = this.wsSymbols();
    if (wsList.length === 0) {
      console.warn('Nessun simbolo valido selezionato');
      return;
    }

    // Ferma connessione esistente
    this.stop();

    this.isConnecting = true;

    const sub = this.api.connectWS(wsList.join(','), 'miniTicker,kline_1m').subscribe({
      next: (msg: WebSocketMessage) => {
        this.wsOpen = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.messagesReceived++;
        this.lastUpdate = new Date();
        this.lastMsg = msg;

        if (msg?.type === 'miniTicker') {
          this.updateTickerData(msg.payload as MiniTicker);
        }
        this.cdr.markForCheck();
      },
      error: (err: Error) => {
        console.error('WebSocket error:', err);
        this.isConnecting = false;
        this.wsOpen = false;
        
        // Tentativo di riconnessione
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          this.reconnectTimer = setTimeout(() => this.startWebSocket(), 2000 * this.reconnectAttempts);
        }
        this.cdr.markForCheck();
      },
      complete: () => {
        this.isConnecting = false;
        this.wsOpen = false;
        this.cdr.markForCheck();
      }
    });

    this.subscriptions.push(sub);
  }

  stop() {
    if (this.wsSubscription) {
      this.wsSubscription.unsubscribe();
      this.wsSubscription = null;
    }
    this.wsOpen = false;
    this.isConnecting = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  refresh() {
    const list = this.wsSymbols();
    if (list.length === 0) {
      this.miniTickers.set([]);
      return;
    }

    const sub = this.api.latestMini(list).subscribe({
      next: (data: MiniTicker[]) => {
        const allowed = new Set(this.selectedSymbolsArr());
        this.miniTickers.set(data.filter(t => allowed.has(t.symbol)));
        this.lastUpdate = new Date();
        this.cdr.markForCheck();
      },
      error: (err: Error) => {
        console.error('Error refreshing data:', err);
      }
    });

    this.subscriptions.push(sub);
  }

  clearFeed() {
    this.lastMsg = null;
    this.messagesReceived = 0;
  }

  private updateTickerData(newData: MiniTicker) {
    const allowed = new Set(this.selectedSymbolsArr());
    if (!allowed.has(newData.symbol)) return;

    const current = this.miniTickers();
    const idx = current.findIndex(t => t.symbol === newData.symbol);

    if (idx >= 0) {
      const copy = [...current];
      copy[idx] = { ...copy[idx], ...newData };
      this.miniTickers.set(copy);
    } else {
      this.miniTickers.set([...current, newData]);
    }

    // Aggiorna analytics
    this.analyticsService.updatePrice(newData.symbol, newData.last_price);

    const chartSet = new Set(this.chartSymbols());
    if (chartSet.has(newData.symbol)) {
      this.updateChartData(newData);
    }

    this.checkPriceAlerts(newData);
    this.cdr.markForCheck();
  }

  private updateChartData(ticker: MiniTicker) {
    const now = new Date();
    const timeLabel = now.toLocaleTimeString();

    const labels = this.chartLabels();
    this.chartLabels.set(labels.length >= 50 ? [...labels.slice(1), timeLabel] : [...labels, timeLabel]);

    const hist = { ...this.priceHistory() };
    const arr = hist[ticker.symbol] ?? [];
    hist[ticker.symbol] = arr.length >= 50 ? [...arr.slice(1), ticker.last_price] : [...arr, ticker.last_price];
    this.priceHistory.set(hist);
  }

  getPriceHistory(symbol: string): number[] {
    return this.priceHistory()[symbol] ?? [];
  }

  private checkPriceAlerts(ticker: MiniTicker) {
  console.log('Checking price alerts for:', ticker.symbol, ticker.last_price);
  const triggeredAlerts = this.alertService.checkAlerts(ticker.symbol, ticker.last_price);
  console.log('Triggered alerts:', triggeredAlerts);
  
  triggeredAlerts.forEach(alert => {
    this.showAlertNotification(alert, ticker.last_price);
  });
}

  private showAlertNotification(alert: any, currentPrice: number) {
    if (!this.isBrowser) return;

    const message = `🚨 ${alert.symbol} ${alert.condition === 'above' ? 'supera' : 'scende sotto'} $${alert.price}!
Prezzo attuale: $${currentPrice}`;

    if (typeof Notification !== 'undefined') {
      if (Notification.permission === 'granted') {
        new Notification('Alert Prezzo Attivato!', { body: message });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            new Notification('Alert Prezzo Attivato!', { body: message });
          }
        });
      }
    }
    this.playAlertSound();
  }

  // dashboard.component.ts - aggiungi questa proprietà
analyticsSymbol: string = '';

// aggiorna il metodo selectTicker
selectTicker(ticker: MiniTicker) {
  this.selectedTicker = ticker.symbol;
  this.analyticsSymbol = ticker.symbol; // Imposta il simbolo per analytics
}

// aggiungi metodo per deselezionare
clearSelection() {
  this.selectedTicker = '';
  this.analyticsSymbol = '';
}

  // Metodo per ottenere i dettagli di un ticker specifico
  getTickerDetails(symbol: string): MiniTicker | null {
    return this.miniTickers().find(t => t.symbol === symbol) || null;
  }

  // Metodo per calcolare la percentuale di cambiamento del prezzo
  getPriceChangePercent(ticker: MiniTicker): number {
    const midPrice = (ticker.high_price + ticker.low_price) / 2;
    return midPrice !== 0 ? ((ticker.last_price - midPrice) / midPrice) * 100 : 0;
  }

  private playAlertSound() {
    if (!this.isBrowser) return;
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);

      const gainNode = audioContext.createGain();
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch {
      console.log('\u0007');
    }
  }

  getActiveSymbolsCount(): number {
    return this.selectedSymbolsArr().length;
  }

   onSymbolsChange(symbolsString: string) {
    const valid = symbolsString.split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);
    
    this.symbolsInput = valid.join(',');
    
    // Se la stringa è vuota, pulisci tutto
    if (valid.length === 0) {
      this.onClearAll();
      return;
    }
    
    if (this.wsOpen) {
      this.api.updateWSSymbols(valid).subscribe(success => {
        if (!success) {
          this.stop();
          this.startWebSocket();
        }
      });
    } else {
      this.refresh();
    }
    
    const allowed = new Set(valid);
    this.miniTickers.set(this.miniTickers().filter(t => allowed.has(t.symbol)));
  }
}
