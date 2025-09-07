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

@Component({
  standalone: true,
  selector: 'app-dashboard',
  imports: [CommonModule, HttpClientModule, FormsModule, PriceChartComponent, AlertManagerComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  private api = inject(BinanceApiService);
  private alertService = inject(AlertService);
  private isBrowser: boolean;
  
  symbolsInput = 'btcusdt,ethusdt';
  wsOpen = false;
  isConnecting = false;
  lastMsg: WebSocketMessage | null = null;
  messagesReceived = 0;
  lastUpdate: Date | null = null;
  miniTickers = signal<MiniTicker[]>([]);
  
  btcPriceHistory = signal<number[]>([]);
  ethPriceHistory = signal<number[]>([]);
  chartLabels = signal<string[]>([]);
  
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

  start() {
    this.isConnecting = true;
    
    this.wsSubscription = this.api.connectWS(this.symbolsInput, 'miniTicker,kline_1m').subscribe({
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
    const list = this.symbolsInput.split(',');
    this.api.latestMini(list).subscribe({
      next: (data: MiniTicker[]) => {
        this.miniTickers.set(data);
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

  private updateTickerData(newData: MiniTicker) {
    const currentTickers = this.miniTickers();
    const existingIndex = currentTickers.findIndex(t => t.symbol === newData.symbol);
    
    if (existingIndex >= 0) {
      const updatedTickers = [...currentTickers];
      updatedTickers[existingIndex] = {
        ...updatedTickers[existingIndex],
        ...newData
      };
      this.miniTickers.set(updatedTickers);
      
      this.updateChartData(newData);
      this.checkPriceAlerts(newData);
    } else {
      this.miniTickers.set([...currentTickers, newData]);
    }
  }

  private updateChartData(ticker: MiniTicker) {
    const now = new Date();
    const timeLabel = now.toLocaleTimeString();
    
    if (this.chartLabels().length >= 20) {
      this.chartLabels.set([...this.chartLabels().slice(1), timeLabel]);
    } else {
      this.chartLabels.set([...this.chartLabels(), timeLabel]);
    }
    
    if (ticker.symbol === 'btcusdt') {
      if (this.btcPriceHistory().length >= 20) {
        this.btcPriceHistory.set([...this.btcPriceHistory().slice(1), ticker.last_price]);
      } else {
        this.btcPriceHistory.set([...this.btcPriceHistory(), ticker.last_price]);
      }
    }
    
    if (ticker.symbol === 'ethusdt') {
      if (this.ethPriceHistory().length >= 20) {
        this.ethPriceHistory.set([...this.ethPriceHistory().slice(1), ticker.last_price]);
      } else {
        this.ethPriceHistory.set([...this.ethPriceHistory(), ticker.last_price]);
      }
    }
  }

  private checkPriceAlerts(ticker: MiniTicker) {
    const triggeredAlerts = this.alertService.checkAlerts(ticker.symbol, ticker.last_price);
    
    triggeredAlerts.forEach(alert => {
      this.showAlertNotification(alert, ticker.last_price);
    });
  }

  private showAlertNotification(alert: any, currentPrice: number) {
    // Solo nel browser
    if (!this.isBrowser) return;
    
    const message = `🚨 ${alert.symbol} ${alert.condition === 'above' ? 'supera' : 'scende sotto'} $${alert.price}!
Prezzo attuale: $${currentPrice}`;
    
    // Notifiche browser
    if (typeof Notification !== 'undefined') {
      if (Notification.permission === 'granted') {
        new Notification('Alert Prezzo Attivato!', { body: message });
      } else if (Notification.permission !== 'denied') {
        // Richiedi il permesso se non è stato ancora fatto
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            new Notification('Alert Prezzo Attivato!', { body: message });
          }
        });
      }
    }
    
    console.log('ALERT ATTIVATO:', message);
    this.playAlertSound();
  }

  private playAlertSound() {
    // Solo nel browser
    if (!this.isBrowser) return;
    
    try {
      // Tentativo di riprodurre un suono
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
    } catch (error) {
      // Fallback al beep della console
      console.log('\u0007');
    }
  }

  getPriceChange(ticker: MiniTicker): number {
    const midPrice = (ticker.high_price + ticker.low_price) / 2;
    return ticker.last_price - midPrice;
  }
}