// services/binance-api.service.ts
import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
  Observable,
  Subject,
  map,
  shareReplay,
  of,
  tap,
  catchError,
  EMPTY
} from 'rxjs';

export interface MiniTicker {
  symbol: string;
  event_time: number;
  last_price: number;
  high_price: number;
  low_price: number;
  volume: number;
}

export interface WebSocketMessage {
  type: string;
  payload: any;
}

@Injectable({ providedIn: 'root' })
export class BinanceApiService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);

  private baseUrl = 'https://api.binance.com/api/v3';
  private ws?: WebSocket;
  private wsSubject = new Subject<WebSocketMessage>();
  private currentSymbols: string = '';

  private priceCache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_DURATION = 10000;

  // ------------------ WEBSOCKET ------------------

  connectWS(symbols: string, types: string): Observable<WebSocketMessage> {
    if (!isPlatformBrowser(this.platformId)) {
      return EMPTY; // ⛔ niente WS lato server
    }

    this.currentSymbols = symbols;
    const validSymbols = symbols
      .split(',')
      .filter(symbol => symbol.trim().length > 0);

    if (validSymbols.length === 0) {
      return EMPTY;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }

    const formattedSymbols = validSymbols.map(s => {
      const cleanSymbol = s.trim().toLowerCase();
      return cleanSymbol.endsWith('usdt') ? cleanSymbol : `${cleanSymbol}usdt`;
    });

    const streams = formattedSymbols
      .map(symbol => `${symbol}@miniTicker`)
      .join('/');
    const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streams}`;

    console.log('Connecting to WebSocket:', wsUrl);

    return new Observable<WebSocketMessage>(subscriber => {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        subscriber.next({
          type: 'connected',
          payload: { status: 'connected' }
        });
      };

      this.ws.onmessage = (ev: MessageEvent) => {
        try {
          const data = JSON.parse(ev.data as any);

          if (data.stream && data.data) {
            const streamType = data.stream.split('@')[1];
            const symbol = data.stream
              .split('@')[0]
              .toLowerCase()
              .replace('usdt', '');

            if (streamType === 'miniTicker') {
              const message: WebSocketMessage = {
                type: 'miniTicker',
                payload: this.formatMiniTicker(data.data, symbol)
              };
              this.wsSubject.next(message);
              subscriber.next(message);
            }
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onerror = error => subscriber.error(error);
      this.ws.onclose = () => subscriber.complete();

      return () => {
        if (this.ws) {
          this.ws.close();
        }
      };
    }).pipe(shareReplay(1));
  }

  // 🔄 Metodo per aggiornare i simboli WS senza ricreare tutto
  updateWSSymbols(newSymbols: string[]): Observable<boolean> {
    if (!isPlatformBrowser(this.platformId) || !this.ws) {
      return of(false);
    }

    const newSymbolsString = newSymbols.filter(s => s.trim()).join(',');
    if (this.currentSymbols === newSymbolsString) {
      return of(true);
    }

    try {
      const updateMessage = {
        action: 'update_symbols',
        symbols: newSymbolsString
      };
      this.ws.send(JSON.stringify(updateMessage));
      this.currentSymbols = newSymbolsString;
      return of(true);
    } catch (err) {
      console.error('updateWSSymbols error:', err);
      return of(false);
    }
  }

  private formatMiniTicker(data: any, symbol: string): MiniTicker {
    return {
      symbol: symbol,
      event_time: data.E,
      last_price: parseFloat(data.c),
      high_price: parseFloat(data.h),
      low_price: parseFloat(data.l),
      volume: parseFloat(data.v)
    };
  }

  // ------------------ REST API ------------------

  latestMini(symbols: string[]): Observable<MiniTicker[]> {
    if (!isPlatformBrowser(this.platformId)) {
      return of([]);
    }

    const validSymbols = symbols.filter(s => s.trim().length > 0);
    if (validSymbols.length === 0) {
      return of([]);
    }

    const formattedSymbols = validSymbols.map(s => {
      const clean = s.trim().toUpperCase();
      return clean.endsWith('USDT') ? clean : `${clean}USDT`;
    });

    const params = new HttpParams().set(
      'symbols',
      JSON.stringify(formattedSymbols)
    );

    return this.http
      .get<any[]>(`${this.baseUrl}/ticker/24hr`, { params })
      .pipe(
        map(response => (Array.isArray(response) ? response : [])),
        map(tickers =>
          tickers.map(item => ({
            symbol: item.symbol.toLowerCase().replace('usdt', ''),
            event_time: item.closeTime,
            last_price: parseFloat(item.lastPrice),
            high_price: parseFloat(item.highPrice),
            low_price: parseFloat(item.lowPrice),
            volume: parseFloat(item.volume)
          }))
        ),
        map(arr => arr.sort((a, b) => a.symbol.localeCompare(b.symbol))),
        catchError(error => {
          console.error('Error fetching market data:', error);
          return of(
            validSymbols.map(symbol => this.createFallbackTicker(symbol))
          );
        })
      );
  }

  getHistoricalData(
    symbol: string,
    interval: string = '1m',
    limit: number = 50
  ): Observable<any[]> {
    if (!isPlatformBrowser(this.platformId)) {
      return of([]);
    }

    const cacheKey = `${symbol}-${interval}-${limit}`;
    const cached = this.priceCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return of(cached.data);
    }

    const params = new HttpParams()
      .set('symbol', `${symbol.toUpperCase()}USDT`)
      .set('interval', interval)
      .set('limit', limit.toString());

    return this.http.get<any[]>(`${this.baseUrl}/klines`, { params }).pipe(
      map(klines =>
        klines.map(k => ({
          openTime: k[0],
          open: parseFloat(k[1]),
          high: parseFloat(k[2]),
          low: parseFloat(k[3]),
          close: parseFloat(k[4]),
          volume: parseFloat(k[5]),
          closeTime: k[6],
          quoteVolume: parseFloat(k[7]),
          trades: k[8]
        }))
      ),
      tap(data => {
        this.priceCache.set(cacheKey, { data, timestamp: Date.now() });
      }),
      catchError(error => {
        console.error('Error fetching historical data:', error);
        return of([]);
      })
    );
  }

  getMarketStatus(): Observable<any> {
    if (!isPlatformBrowser(this.platformId)) {
      return of({ totalVolume: 0, totalTrades: 0, timestamp: Date.now() });
    }

    return this.http.get<any[]>(`${this.baseUrl}/ticker/24hr`).pipe(
      map((data: any) => {
        if (Array.isArray(data)) {
          return {
            totalVolume: data.reduce(
              (sum: number, item: any) => sum + parseFloat(item.volume),
              0
            ),
            totalTrades: data.reduce(
              (sum: number, item: any) => sum + item.count,
              0
            ),
            timestamp: Date.now()
          };
        }
        return { totalVolume: 0, totalTrades: 0, timestamp: Date.now() };
      }),
      catchError(error => {
        console.error('Error fetching market status:', error);
        return of({ totalVolume: 0, totalTrades: 0, timestamp: Date.now() });
      })
    );
  }

  // ------------------ UTILITIES ------------------

  private createFallbackTicker(symbol: string): MiniTicker {
    const basePrice = this.getFallbackPrice(symbol);
    return {
      symbol: symbol,
      event_time: Date.now(),
      last_price:
        basePrice * (1 + (Math.random() - 0.5) * 0.01), // ±0.5%
      high_price: basePrice * (1 + Math.random() * 0.02),
      low_price: basePrice * (1 - Math.random() * 0.01),
      volume: Math.random() * 1000000 + 1000
    };
  }

  private getFallbackPrice(symbol: string): number {
    const priceMap: { [key: string]: number } = {
      btc: 50000,
      eth: 3000,
      bnb: 400,
      ada: 1.2,
      sol: 100,
      xrp: 0.6,
      doge: 0.15,
      matic: 1.0,
      dot: 6.5,
      avax: 35,
      link: 15,
      ltc: 70,
      atom: 10,
      etc: 25,
      xlm: 0.12,
      icp: 5,
      fil: 5,
      hbar: 0.07,
      near: 3,
      uni: 6,
      bch: 250,
      algo: 0.18,
      vet: 0.03,
      xtz: 1.0
    };

    return priceMap[symbol] || 100;
  }

  getPopularSymbols(): string[] {
    return [
      'btc',
      'eth',
      'bnb',
      'sol',
      'ada',
      'xrp',
      'doge',
      'matic',
      'dot',
      'avax',
      'link',
      'ltc',
      'atom',
      'etc',
      'xlm',
      'icp',
      'fil',
      'hbar',
      'near',
      'uni',
      'bch',
      'algo',
      'vet',
      'xtz'
    ];
  }

  searchSymbols(query: string): string[] {
    const allSymbols = this.getPopularSymbols();
    return allSymbols.filter(symbol =>
      symbol.toLowerCase().includes(query.toLowerCase())
    );
  }

  checkConnection(): Observable<boolean> {
    if (!isPlatformBrowser(this.platformId)) {
      return of(false);
    }

    return this.http.get(`${this.baseUrl}/ping`).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }

  testConnection(): Observable<boolean> {
    if (!isPlatformBrowser(this.platformId)) {
      return of(false);
    }

    return this.http
      .get(`${this.baseUrl}/ping`, {
        observe: 'response'
      })
      .pipe(
        map(() => {
          console.log('✅ Binance API is accessible');
          return true;
        }),
        catchError(error => {
          console.error('❌ Binance API not accessible:', error);
          return of(false);
        })
      );
  }
}
