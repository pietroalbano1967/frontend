import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, Subject, map, shareReplay, of } from 'rxjs';

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
  private baseUrl = 'http://localhost:8000';
  private ws?: WebSocket;
  private wsSubject = new Subject<WebSocketMessage>();
  private currentSymbols: string = '';
  
   updateWSSymbols(newSymbols: string[]): Observable<boolean> {
    return new Observable<boolean>(subscriber => {
      const newSymbolsString = newSymbols.filter(s => s.trim()).join(',');
      
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        subscriber.next(false);
        subscriber.complete();
        return;
      }
      
      if (this.currentSymbols === newSymbolsString) {
        subscriber.next(true);
        subscriber.complete();
        return;
      }
      
      const updateMessage = {
        action: 'update_symbols',
        symbols: newSymbolsString
      };
      
      this.ws.send(JSON.stringify(updateMessage));
      
      // Timeout per la conferma
      const timeout = setTimeout(() => {
        subscriber.next(false);
        subscriber.complete();
      }, 5000);
      
      // Listener per conferma (da implementare nel server)
      const messageHandler = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'symbols_updated') {
            clearTimeout(timeout);
            this.currentSymbols = newSymbolsString;
            subscriber.next(true);
            subscriber.complete();
          }
        } catch (e) {
          // Ignora messaggi non JSON
        }
      };
      
      this.ws.addEventListener('message', messageHandler);
      
      return () => {
        this.ws?.removeEventListener('message', messageHandler);
        clearTimeout(timeout);
      };
    });
  }
  
  connectWS(symbols: string, types: string): Observable<WebSocketMessage> {
  this.currentSymbols = symbols;
  const validSymbols = symbols.split(',').filter(symbol => symbol.trim().length > 0);
  
  if (validSymbols.length === 0) {
    return new Observable<WebSocketMessage>(subscriber => {
      subscriber.complete();
    });
  }
  
  // Chiudi connessione esistente
  if (this.ws) {
    this.ws.close();
    this.ws = undefined;
  }
  
  const symbolsString = validSymbols.join(',');
  const url = `${this.baseUrl.replace('http','ws')}/api/market/ws/stream?symbols=${encodeURIComponent(symbolsString)}&types=${encodeURIComponent(types)}`;
  
  return new Observable<WebSocketMessage>(subscriber => {
    this.ws = new WebSocket(url);
    
    this.ws.onopen = () => {
      console.log('WebSocket connected for symbols:', symbolsString);
    };
    
    this.ws.onmessage = (ev: MessageEvent) => {
      try {
        const message: WebSocketMessage = JSON.parse(ev.data);
        this.wsSubject.next(message);
        subscriber.next(message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      subscriber.error(error);
    };
    
    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      subscriber.complete();
    };
    
    // invia ping applicativo ogni 20s
    const pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send('ping');
      }
    }, 20000);
    
    // Cleanup function
    return () => {
      clearInterval(pingInterval);
      if (this.ws) {
        this.ws.close();
      }
    };
  }).pipe(shareReplay(1));
}

  latestMini(symbols: string[]): Observable<MiniTicker[]> {
    // Filtra simboli vuoti
    const validSymbols = symbols.filter(symbol => symbol.trim().length > 0);
    if (validSymbols.length === 0) {
      return of([]);
    }
    
    const params = new HttpParams({ fromObject: { symbol: validSymbols } });
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

  getPopularSymbols(): string[] {
    return [
      'btcusdt', 'ethusdt', 'bnbusdt', 'solusdt', 'adausdt',
      'xrpusdt', 'dogeusdt', 'maticusdt', 'dotusdt', 'avaxusdt',
      'linkusdt', 'ltcusdt', 'atomusdt', 'etcusdt', 'xlmusdt',
      'icpusdt', 'filusdt', 'hbarusdt', 'nearusdt', 'uniusdt'
    ];
  }

  searchSymbols(query: string): string[] {
    const allSymbols = this.getPopularSymbols();
    return allSymbols.filter(symbol => 
      symbol.toLowerCase().includes(query.toLowerCase())
    );
  }
}