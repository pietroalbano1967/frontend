// services/portfolio.service.ts
import { Injectable, signal, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { INITIAL_CONFIG } from '@angular/platform-server';
import { Subject, Observable } from 'rxjs';
export interface Position {
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  pnl: number;
  pnlPercent: number;
  stopLoss: number;
  takeProfit: number;
  entryTime: number;
}

export interface Trade {
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  pnlPercent: number;
  duration: number;
  entryTime: number;
  exitTime: number;
}

export interface Portfolio {
  cash: number;
  equity: number;
  totalValue: number;
}

@Injectable({ providedIn: 'root' })
export class PortfolioService {
  private initialCash = 10000;
  private portfolioUpdated = new Subject<void>();
  // Segnali per lo stato reattivo
  portfolio = signal<Portfolio>({
    cash: this.initialCash,
    equity: 0,
    totalValue: this.initialCash
  });

  positions = signal<Position[]>([]);
  tradeHistory = signal<Trade[]>([]);

  constructor(@Inject(PLATFORM_ID) private platformId: any) {
    // Solo nel browser
    if (!isPlatformServer(this.platformId)) {
      console.log('PortfolioService initialized');
    }
  }

  initiliazePortfolio(initialCash: number) {
    this.initialCash = initialCash;
    this.resetPortfolio();
  }
  exportPortfolioData() {
    throw new Error('Method not implemented.');
  }

  // Ottiene il portfolio corrente
  getPortfolio(): Portfolio {
    return this.portfolio();
  }
  getPortfolioUpdated(): Observable<void> {
  return this.portfolioUpdated.asObservable();
  }
  // Ottiene le posizioni correnti
  currentPositions(): Position[] {
    return this.positions();
  }
  

  // Ottiene la cronologia dei trade
  getTradeHistory(): Trade[] {
    return this.tradeHistory();
  }
  addTrade(trade: Trade): void {
    this.tradeHistory.update(history => [trade, ...history]);
  }
  
  getportfolioSnapshot(): Portfolio {
    return this.portfolio();
  } 

  getTradeHistorySnapshot(): Trade[] {
    return this.tradeHistory();
  } 
  // Apre una nuova posizione
  openPosition(
    symbol: string,
    direction: 'LONG' | 'SHORT',
    entryPrice: number,
    quantity: number,
    stopLoss?: number,
    takeProfit?: number
  ): boolean {
    const currentPortfolio = this.portfolio();
    const requiredCash = direction === 'LONG' 
      ? entryPrice * quantity 
      : entryPrice * quantity * 2; // Per SHORT, margine richiesto

    if (currentPortfolio.cash < requiredCash) {
      console.warn('Insufficient funds to open position');
      return false;
    }

    const newPosition: Position = {
      symbol,
      direction,
      entryPrice,
      currentPrice: entryPrice,
      quantity,
      pnl: 0,
      pnlPercent: 0,
      stopLoss: stopLoss || this.calculateStopLoss(entryPrice, direction),
      takeProfit: takeProfit || this.calculateTakeProfit(entryPrice, direction),
      entryTime: Date.now()
    };

    // Aggiorna le posizioni
    this.positions.update(positions => [...positions, newPosition]);

    // Aggiorna il portfolio
    this.portfolio.update(current => ({
      ...current,
      cash: current.cash - (direction === 'LONG' ? entryPrice * quantity : entryPrice * quantity),
      equity: current.equity + (direction === 'LONG' ? entryPrice * quantity : 0),
      totalValue: current.cash - (direction === 'LONG' ? entryPrice * quantity : entryPrice * quantity) + current.equity
    }));

    console.log(`Opened ${direction} position for ${symbol}`, newPosition);
    return true;
  }

  // Chiude una posizione
  closePosition(symbol: string, exitPrice: number, pnl: number): void {
    const position = this.positions().find(p => p.symbol === symbol);
    
    if (!position) {
      console.warn(`Position not found for symbol: ${symbol}`);
      return;
    }

    // Calcola PnL percentuale
    const pnlPercent = (pnl / (position.entryPrice * position.quantity)) * 100;

    // Crea il trade per la cronologia
    const trade: Trade = {
      symbol,
      direction: position.direction,
      entryPrice: position.entryPrice,
      exitPrice,
      quantity: position.quantity,
      pnl,
      pnlPercent,
      duration: Math.floor((Date.now() - position.entryTime) / 60000), // minuti
      entryTime: position.entryTime,
      exitTime: Date.now()
    };

    // Rimuovi dalla posizione corrente
    this.positions.update(positions => positions.filter(p => p.symbol !== symbol));

    // Aggiungi alla cronologia
    this.tradeHistory.update(history => [trade, ...history]);

    // Aggiorna il portfolio
    this.portfolio.update(current => {
      const cashChange = position.direction === 'LONG' 
        ? exitPrice * position.quantity 
        : position.entryPrice * position.quantity * 2 - exitPrice * position.quantity;

      return {
        ...current,
        cash: current.cash + cashChange,
        equity: current.equity - (position.entryPrice * position.quantity),
        totalValue: current.cash + cashChange + current.equity - (position.entryPrice * position.quantity)
      };
    });

    console.log(`Closed position for ${symbol}`, trade);
  }

  // Aggiorna i prezzi delle posizioni correnti
  updatePositionPrices(currentPrices: Map<string, number>): void {
    this.positions.update(positions => 
      positions.map(position => {
        const currentPrice = currentPrices.get(position.symbol) || position.currentPrice;
        const pnl = position.direction === 'LONG'
          ? (currentPrice - position.entryPrice) * position.quantity
          : (position.entryPrice - currentPrice) * position.quantity;
        
        const pnlPercent = (pnl / (position.entryPrice * position.quantity)) * 100;

        return {
          ...position,
          currentPrice,
          pnl,
          pnlPercent
        };
      })
    );

    // Aggiorna anche il valore totale del portfolio
    this.updatePortfolioValue();
  }

  // Aggiorna il valore totale del portfolio
  private updatePortfolioValue(): void {
    const totalEquity = this.positions().reduce((sum, position) => {
      return sum + (position.currentPrice * position.quantity);
    }, 0);

    this.portfolio.update(current => ({
      ...current,
      equity: totalEquity,
      totalValue: current.cash + totalEquity
    }));
  }

  // Resetta il portfolio allo stato iniziale
  resetPortfolio(): void {
    this.portfolio.set({
      cash: this.initialCash,
      equity: 0,
      totalValue: this.initialCash
    });
    this.positions.set([]);
    this.tradeHistory.set([]);
    console.log('Portfolio reset to initial state');
  }

  // Calcola lo stop loss automatico
  private calculateStopLoss(entryPrice: number, direction: 'LONG' | 'SHORT'): number {
    const stopLossPercent = 0.02; // 2%
    return direction === 'LONG' 
      ? entryPrice * (1 - stopLossPercent)
      : entryPrice * (1 + stopLossPercent);
  }

  // Calcola il take profit automatico
  private calculateTakeProfit(entryPrice: number, direction: 'LONG' | 'SHORT'): number {
    const takeProfitPercent = 0.04; // 4%
    return direction === 'LONG' 
      ? entryPrice * (1 + takeProfitPercent)
      : entryPrice * (1 - takeProfitPercent);
  }

  // Chiude la posizione usando il simulatore (integrazione con TradingSimulatorService)
  async closePositionWithSimulator(symbol: string, reason: string): Promise<boolean> {
    const position = this.positions().find(p => p.symbol === symbol);
    
    if (!position) {
      console.warn(`Position not found for symbol: ${symbol}`);
      return false;
    }

    // Simula la chiusura (questa funzione dovrebbe essere implementata nel TradingSimulatorService)
    // Per ora, chiudiamo direttamente con il prezzo corrente
    this.closePosition(symbol, position.currentPrice, position.pnl);
    
    console.log(`Closed position for ${symbol} due to: ${reason}`);
    return true;
  }

  // Ottiene le statistiche del portfolio
  getPortfolioStats() {
    const trades = this.tradeHistory();
    const winningTrades = trades.filter(trade => trade.pnl > 0).length;
    const losingTrades = trades.filter(trade => trade.pnl < 0).length;
    const totalTrades = trades.length;
    
    return {
      totalTrades,
      winningTrades,
      losingTrades,
      winRate: totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0,
      totalProfit: trades.reduce((sum, trade) => sum + trade.pnl, 0),
      avgProfitPerTrade: totalTrades > 0 ? trades.reduce((sum, trade) => sum + trade.pnl, 0) / totalTrades : 0
    };
  }
}