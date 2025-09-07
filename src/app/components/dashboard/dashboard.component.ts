import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import  { MiniTicker, WebSocketMessage } from './../../types/binance.types';
import { BinanceApiService, } from '../../services/binance-api.service';
import { PriceChartComponent } from '../chart/chart.component';

@Component({
  standalone: true,
  selector: 'app-dashboard',
  imports: [CommonModule, HttpClientModule, FormsModule, PriceChartComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  constructor(private api: BinanceApiService) {}
  
  symbolsInput = 'btcusdt,ethusdt';
  wsOpen = false;
  isConnecting = false;
  lastMsg: WebSocketMessage | null = null;
  messagesReceived = 0;
  lastUpdate: Date | null = null;
  miniTickers = signal<MiniTicker[]>([]);
  
  // Aggiungi queste nuove signals per i grafici
  btcPriceHistory = signal<number[]>([]);
  ethPriceHistory = signal<number[]>([]);
  chartLabels = signal<string[]>([]);
  
  private wsSubscription: Subscription | null = null;

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
      
      // Aggiorna i dati per il grafico
      this.updateChartData(newData);
    } else {
      this.miniTickers.set([...currentTickers, newData]);
    }
  }

  private updateChartData(ticker: MiniTicker) {
    const now = new Date();
    const timeLabel = now.toLocaleTimeString();
    
    // Aggiorna le labels
    if (this.chartLabels().length >= 20) {
      this.chartLabels.set([...this.chartLabels().slice(1), timeLabel]);
    } else {
      this.chartLabels.set([...this.chartLabels(), timeLabel]);
    }
    
    // Aggiorna i dati del prezzo in base al simbolo
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

  getPriceChange(ticker: MiniTicker): number {
    const midPrice = (ticker.high_price + ticker.low_price) / 2;
    return ticker.last_price - midPrice;
  }
}