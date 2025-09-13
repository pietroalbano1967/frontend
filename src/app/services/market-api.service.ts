import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, EMPTY, shareReplay } from 'rxjs';

export type MarketMsg =
  | { type:'connected'; payload:any }
  | { type:'miniTicker'; payload: MiniTicker }
  | { type:'kline'; payload: Kline }
  | { type:'symbols_updated'; payload:any };

export interface MiniTicker {
  symbol: string;      // es. "btcusdt" o "btc"
  event_time: number;
  last_price: number;
  high_price: number;
  low_price: number;
  volume: number;
}

export interface Kline {
  symbol: string;
  start_time: number;
  close_time: number;
  open_price: number;
  high_price: number;
  low_price: number;
  close_price: number;
  volume: number;
  trades?: number;
}

@Injectable({ providedIn: 'root' })
export class MarketApiService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private ws?: WebSocket;

  /**
   * 🔧 Cambia SOLO questa riga per direzionare il servizio:
   * - Trading Simulator: '/api/simulator'
   * - (vecchio) Market:  '/api/market'
   */
  private readonly BASE = '/api/simulator';

  connectWS(symbols: string[], types: string[] = ['miniTicker']): Observable<MarketMsg> {
    if (!isPlatformBrowser(this.platformId)) return EMPTY;

    if (this.ws) { this.ws.close(); this.ws = undefined; }

    const syms  = symbols.map(s => s.trim().toLowerCase()).filter(Boolean).join(',');
    const kinds = types.join(',');

    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const url   = `${proto}://${location.host}${this.BASE}/ws/stream?symbols=${encodeURIComponent(syms)}&types=${encodeURIComponent(kinds)}`;

    return new Observable<MarketMsg>(sub => {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => sub.next({ type:'connected', payload:{ status:'connected' } });

      this.ws.onmessage = (ev: MessageEvent) => {
        try { sub.next(JSON.parse(ev.data as any) as MarketMsg); } catch { /* ignore */ }
      };

      this.ws.onerror = (e) => sub.error(e);
      this.ws.onclose = () => sub.complete();

      return () => this.ws?.close();
    }).pipe(shareReplay(1));
  }

  /**
   * Il Trading Simulator non richiede update via messaggio?
   * In tal caso fai semplicemente reconnect dal componente.
   * Lasciamo comunque un metodo stub: ritorna false se WS assente.
   */
  updateWSSymbols(symbols: string[], types: string[] = ['miniTicker']): Observable<boolean> {
    if (!isPlatformBrowser(this.platformId) || !this.ws) {
      return new Observable(o => { o.next(false); o.complete(); });
    }
    try {
      // Se il tuo FastAPI ACCETTA update via messaggio, abilita qui:
      // this.ws!.send(JSON.stringify({ action:'update_symbols', symbols, types }));
      return new Observable(o => { o.next(false); o.complete(); }); // di default: non supportato
    } catch {
      return new Observable(o => { o.next(false); o.complete(); });
    }
  }

  /** Snapshot 24h dal Trading Simulator */
  latestMini(symbols: string[]): Observable<MiniTicker[]> {
    if (!isPlatformBrowser(this.platformId)) return EMPTY;
    let params = new HttpParams();
    // FastAPI: multipli ?symbol=...
    symbols.forEach(s => params = params.append('symbol', s));
    return this.http.get<MiniTicker[]>(`${this.BASE}/mini/latest`, { params });
  }

  /** Storico candele dal Trading Simulator */
  klines(symbol: string, interval='1m', limit=150): Observable<Kline[]> {
    if (!isPlatformBrowser(this.platformId)) return EMPTY;
    const params = new HttpParams().set('symbol', symbol).set('interval', interval).set('limit', limit);
    return this.http.get<Kline[]>(`${this.BASE}/klines`, { params });
  }
}
