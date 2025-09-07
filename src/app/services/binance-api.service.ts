import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, Subject, map, shareReplay } from 'rxjs';
import { MiniTicker, WebSocketMessage } from '../types/binance.types';

@Injectable({ providedIn: 'root' })
export class BinanceApiService {
  private http = inject(HttpClient);
  private baseUrl = 'http://localhost:8000';
  private ws?: WebSocket;
  private wsSubject = new Subject<WebSocketMessage>();

  connectWS(symbols = 'btcusdt,ethusdt', types = 'miniTicker,kline_1m'): Observable<WebSocketMessage> {
    if (this.ws) this.ws.close();
    
    const url = `${this.baseUrl.replace('http','ws')}/api/market/ws/stream?symbols=${encodeURIComponent(symbols)}&types=${encodeURIComponent(types)}`;
    this.ws = new WebSocket(url);
    
    this.ws.onopen = () => console.log('WS open');
    this.ws.onmessage = (ev: MessageEvent) => {
      try {
        const message: WebSocketMessage = JSON.parse(ev.data);
        this.wsSubject.next(message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    this.ws.onclose = () => console.log('WS closed');
    
    // invia ping applicativo ogni 20s
    setInterval(() => this.ws?.send('ping'), 20000);
    
    return this.wsSubject.asObservable().pipe(shareReplay(1));
  }

  latestMini(symbols: string[]): Observable<MiniTicker[]> {
    const params = new HttpParams({ fromObject: { symbol: symbols } });
    return this.http.get<MiniTicker[]>(`${this.baseUrl}/api/market/mini/latest`, { params })
      .pipe(map(arr => arr.sort((a, b) => a.symbol.localeCompare(b.symbol))));
  }

  initTickers(): Observable<string[]> {
    return this.http.post<string[]>(`${this.baseUrl}/api/market/tickers/init`, {});
  }

  listTickers(): Observable<string[]> {
    return this.http.get<string[]>(`${this.baseUrl}/api/market/tickers`);
  }

  
getHistoricalData(symbol: string, interval: string = '1m', limit: number = 50): Observable<any[]> {
  return this.http.get<any[]>(`${this.baseUrl}/api/market/historical/${symbol}?interval=${interval}&limit=${limit}`);
}
}