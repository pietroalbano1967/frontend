import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { BinanceApiService } from '../../services/binance-api.service';
import { MiniTicker, WebSocketMessage } from '../../types/binance.types';

@Component({
  standalone: true,
  selector: 'app-dashboard',
  imports: [CommonModule, HttpClientModule, FormsModule],
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
      // Update existing ticker
      const updatedTickers = [...currentTickers];
      updatedTickers[existingIndex] = {
        ...updatedTickers[existingIndex],
        ...newData
      };
      this.miniTickers.set(updatedTickers);
    } else {
      // Add new ticker
      this.miniTickers.set([...currentTickers, newData]);
    }
  }

  getPriceChange(ticker: MiniTicker): number {
    // Simple price change calculation based on last price vs high/low
    const midPrice = (ticker.high_price + ticker.low_price) / 2;
    return ticker.last_price - midPrice;
  }
}