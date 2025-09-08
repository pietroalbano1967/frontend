import { Component, OnInit, OnDestroy, signal, inject, Inject, PLATFORM_ID } from '@angular/core';
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

const MAX_CHARTS = 2; // quante serie mostrare in grafico

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
    MiniTickerTableComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  private api = inject(BinanceApiService);
  private alertService = inject(AlertService);
  private isBrowser: boolean;

  // Selezione iniziale
  symbolsInput = 'btcusdt,ethusdt';

  wsOpen = false;
  isConnecting = false;
  lastMsg: WebSocketMessage | null = null;
  messagesReceived = 0;
  lastUpdate: Date | null = null;

  // MiniTicker
  miniTickers = signal<MiniTicker[]>([]);

  // Grafici
  chartLabels = signal<string[]>([]);
  // Dizionario prezzi per simbolo
  priceHistory = signal<Record<string, number[]>>({});

  private wsSubscription: Subscription | null = null;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit() {
    this.refresh();
  }

  ngOnDestroy() {
    this.stop();
  }

  /** Array normalizzato dei simboli selezionati */
  private selectedSymbolsArr(): string[] {
    return (this.symbolsInput || '')
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);
  }

  /** Simboli usati per i grafici (primi N selezionati) */
  chartSymbols(): string[] {
    return this.selectedSymbolsArr().slice(0, MAX_CHARTS);
  }

  /** Simboli per WS/refresh: solo selezionati */
  private wsSymbols(): string[] {
    return this.selectedSymbolsArr();
  }

  start() {
    const wsList = this.wsSymbols();
    if (wsList.length === 0) {
      console.warn('Nessun simbolo valido selezionato');
      return;
    }

    this.isConnecting = true;

    this.wsSubscription = this.api.connectWS(wsList.join(','), 'miniTicker,kline_1m').subscribe({
      next: (msg: WebSocketMessage) => {
        this.wsOpen = true;
        this.isConnecting = false;
        this.messagesReceived++;
        this.lastUpdate = new Date();
        this.lastMsg = msg;

        if (msg?.type === 'miniTicker') {
          this.updateTickerData(msg.payload as MiniTicker);
        }
      },
      error: (err: Error) => {
        console.error('WebSocket error:', err);
        this.isConnecting = false;
        this.wsOpen = false;
      },
      complete: () => {
        this.isConnecting = false;
        this.wsOpen = false;
      }
    });
  }

  stop() {
    if (this.wsSubscription) {
      this.wsSubscription.unsubscribe();
      this.wsSubscription = null;
    }
    this.wsOpen = false;
    this.isConnecting = false;
  }

  refresh() {
    const list = this.wsSymbols();
    if (list.length === 0) {
      this.miniTickers.set([]);
      return;
    }

    this.api.latestMini(list).subscribe({
      next: (data: MiniTicker[]) => {
        const allowed = new Set(this.selectedSymbolsArr());
        // Mantieni solo i selezionati
        this.miniTickers.set(data.filter(t => allowed.has(t.symbol)));
        this.lastUpdate = new Date();
      },
      error: (err: Error) => {
        console.error('Error refreshing data:', err);
      }
    });
  }

  clearFeed() {
    this.lastMsg = null;
    this.messagesReceived = 0;
  }

  /** Aggiorna MiniTicker e (se il simbolo è grafico-attivo) la serie prezzi */
  private updateTickerData(newData: MiniTicker) {
    const allowed = new Set(this.selectedSymbolsArr());
    if (!allowed.has(newData.symbol)) return; // ignora simboli non selezionati (es. dopo cambio selezione)

    // aggiorna righe tabella
    const current = this.miniTickers();
    const idx = current.findIndex(t => t.symbol === newData.symbol);

    if (idx >= 0) {
      const copy = [...current];
      copy[idx] = { ...copy[idx], ...newData };
      this.miniTickers.set(copy);
    } else {
      this.miniTickers.set([...current, newData]);
    }

    // aggiorna grafico solo se il simbolo è tra quelli mostrati
    const chartSet = new Set(this.chartSymbols());
    if (chartSet.has(newData.symbol)) {
      this.updateChartData(newData);
    }

    // controlla eventuali alert
    this.checkPriceAlerts(newData);
  }

  private updateChartData(ticker: MiniTicker) {
    const now = new Date();
    const timeLabel = now.toLocaleTimeString();

    // labels
    const labels = this.chartLabels();
    this.chartLabels.set(labels.length >= 50 ? [...labels.slice(1), timeLabel] : [...labels, timeLabel]);

    // history per simbolo
    const hist = { ...this.priceHistory() };
    const arr = hist[ticker.symbol] ?? [];
    hist[ticker.symbol] = arr.length >= 50 ? [...arr.slice(1), ticker.last_price] : [...arr, ticker.last_price];
    this.priceHistory.set(hist);
  }

  getPriceHistory(symbol: string): number[] {
    return this.priceHistory()[symbol] ?? [];
  }

  private checkPriceAlerts(ticker: MiniTicker) {
    const triggeredAlerts = this.alertService.checkAlerts(ticker.symbol, ticker.last_price);
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

  /** Quando l’utente cambia i simboli dal selettore */
  onSymbolsChange(symbolsString: string) {
    const valid = symbolsString
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);

    this.symbolsInput = valid.join(',');

    // Filtra subito la tabella per restare coerenti con la nuova selezione
    const allowed = new Set(valid);
    this.miniTickers.set(this.miniTickers().filter(t => allowed.has(t.symbol)));

    // Riconnetti WS e aggiorna dati
    if (this.wsOpen) {
      this.stop();
      this.start();
    } else {
      // se non eri connesso, almeno ricarica i dati
      this.refresh();
    }
  }
}
