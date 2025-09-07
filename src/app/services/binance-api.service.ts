import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, Subject, map, shareReplay } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class BinanceApiService {
  private http = inject(HttpClient);
  private baseUrl = 'http://localhost:8000';
  private ws?: WebSocket;
  private wsSubject = new Subject<any>();

  connectWS(symbols = 'btcusdt,ethusdt', types = 'miniTicker,kline_1m') {
    if (this.ws) this.ws.close();
    const url = `${this.baseUrl.replace('http','ws')}/api/market/ws/stream?symbols=${encodeURIComponent(symbols)}&types=${encodeURIComponent(types)}`;
    this.ws = new WebSocket(url);
    this.ws.onopen = () => console.log('WS open');
    this.ws.onmessage = (ev) => this.wsSubject.next(JSON.parse(ev.data));
    this.ws.onclose = () => console.log('WS closed');
    // invia ping applicativo ogni 20s
    setInterval(() => this.ws?.send('ping'), 20000);
    return this.wsSubject.asObservable().pipe(shareReplay(1));
  }

  latestMini(symbols: string[]): Observable<any[]> {
    const params = new HttpParams({fromObject: { symbol: symbols }});
    return this.http.get<any[]>(`${this.baseUrl}/api/market/mini/latest`, { params })
      .pipe(map(arr => arr.sort((a,b)=>a.symbol.localeCompare(b.symbol))));
  }

  initTickers(): Observable<string[]> {
    return this.http.post<string[]>(`${this.baseUrl}/api/market/tickers/init`, {});
  }

  listTickers(): Observable<string[]> {
    return this.http.get<string[]>(`${this.baseUrl}/api/market/tickers`);
  }
}
