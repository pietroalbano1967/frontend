// services/trading-simulator.service.ts - CORREZIONE
import { Injectable } from '@angular/core';
import { Observable, of, delay, tap } from 'rxjs';
import { TradingDecision } from './trading-decision.service';

// Definisci un tipo per lo stato dell'ordine
export type OrderStatus = 'FILLED' | 'PARTIALLY_FILLED' | 'CANCELLED' | 'REJECTED' | 'PENDING';

@Injectable({ providedIn: 'root' })
export class TradingSimulatorService {
  
  // Simula l'esecuzione di un ordine (solo simulazione, nessuna operazione reale)
  simulateOrder(decision: TradingDecision): Observable<{
    success: boolean;
    message: string;
    orderId?: string;
    executedPrice: number;
  }> {
    // Simula un ritardo di esecuzione
    const executionDelay = Math.random() * 2000 + 1000; // 1-3 secondi
    
    // 95% di successo nella simulazione
    const success = Math.random() > 0.05;
    
    // Prezzo di esecuzione leggermente diverso dal previsto (slippage simulato)
    const slippage = (Math.random() - 0.5) * 0.002; // ±0.2% slippage
    const executedPrice = decision.entryPrice! * (1 + slippage);
    
    return of({
      success,
      message: success ? 'Order executed successfully' : 'Order failed due to market conditions',
      orderId: success ? this.generateOrderId() : undefined,
      executedPrice
    }).pipe(
      delay(executionDelay),
      tap(result => {
        console.log(`SIMULATED ORDER: ${result.success ? 'SUCCESS' : 'FAILED'}`, {
          symbol: decision.symbol,
          decision: decision.decision,
          requestedPrice: decision.entryPrice,
          executedPrice: result.executedPrice,
          slippage: ((result.executedPrice / decision.entryPrice! - 1) * 100).toFixed(3) + '%'
        });
      })
    );
  }
  
  // Simula la chiusura di una posizione
  simulateClosePosition(symbol: string, quantity: number, currentPrice: number): Observable<{
    success: boolean;
    message: string;
    closedPrice: number;
    pnl: number;
  }> {
    const executionDelay = Math.random() * 1000 + 500; // 0.5-1.5 secondi
    
    // Simula sempre successo per le chiusure
    const closedPrice = currentPrice * (1 + (Math.random() - 0.5) * 0.001); // Piccolo slippage
    
    return of({
      success: true,
      message: 'Position closed successfully',
      closedPrice,
      pnl: 0 // Il PnL viene calcolato altrove
    }).pipe(
      delay(executionDelay)
    );
  }
  
  private generateOrderId(): string {
    return `SIM_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }
  
  // Simula il check dello stato dell'ordine
  simulateOrderStatus(orderId: string): Observable<{
    status: OrderStatus; // Usa il tipo definito
    filledQuantity: number;
    avgPrice: number;
  }> {
    // Definisci esplicitamente il tipo di ritorno
    const statuses: OrderStatus[] = ['FILLED', 'PARTIALLY_FILLED', 'CANCELLED', 'REJECTED', 'PENDING'];
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
    
    const result = {
      status: randomStatus,
      filledQuantity: randomStatus === 'FILLED' ? 1 : randomStatus === 'PARTIALLY_FILLED' ? 0.5 : 0,
      avgPrice: 100 // Valore placeholder
    };

    return of(result).pipe(
      delay(500)
    );
  }
}