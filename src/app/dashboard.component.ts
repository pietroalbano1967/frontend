import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { BinanceApiService } from './services/binance-api.service';

@Component({
  standalone: true,
  selector: 'app-dashboard',
  imports: [CommonModule, HttpClientModule],
  template: `
  <div class="p-4">
    <h1>Realtime Stream</h1>
    <p>Stato WebSocket: <strong>{{ wsOpen ? 'OPEN' : 'CLOSED' }}</strong></p>

    <button (click)="start()" [disabled]="wsOpen">Connetti WS</button>
    <button (click)="refresh()">Aggiorna MiniTicker</button>

    <h3>MiniTicker ({{symbols}})</h3>
    <table border="1" cellpadding="6">
      <thead><tr><th>Symbol</th><th>Last</th><th>High</th><th>Low</th><th>Vol</th></tr></thead>
      <tbody>
        <tr *ngFor="let r of miniTickers()">
          <td>{{r.symbol}}</td><td>{{r.last_price}}</td><td>{{r.high_price}}</td><td>{{r.low_price}}</td><td>{{r.volume}}</td>
        </tr>
      </tbody>
    </table>

    <h3>Feed live</h3>
    <pre style="max-height:240px; overflow:auto">{{ lastMsg | json }}</pre>
  </div>
  `
})
export class DashboardComponent implements OnInit {
  constructor(private api: BinanceApiService) {}
  symbols = 'btcusdt,ethusdt';
  wsOpen = false;
  lastMsg: any = null;
  miniTickers = signal<any[]>([]);

  ngOnInit() {
    this.refresh();
  }

  start() {
    this.api.connectWS(this.symbols, 'miniTicker,kline_1m').subscribe(msg => {
      this.wsOpen = true;
      this.lastMsg = msg;
      if (msg?.type === 'miniTicker') {
        const data = msg.payload;
        const arr = this.miniTickers().filter(x => x.symbol !== data.symbol);
        this.miniTickers.set([...arr, data]);
      }
    });
  }

  refresh() {
    const list = this.symbols.split(',');
    this.api.latestMini(list).subscribe(d => this.miniTickers.set(d));
  }
}
