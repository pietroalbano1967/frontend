// services/portfolio.service.ts
import { Injectable, signal, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { Subject, Observable } from 'rxjs';
import { MarketData} from '../types/binance.types';
import { Trade } from '../types/binance.types'; // ✅ GIUSTO

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

export interface Portfolio {
  cash: number;
  equity: number;
  totalValue: number;
}

@Injectable({ providedIn: 'root' })
export class PortfolioService {
  private initialCash = 10000;
  private portfolioUpdated = new Subject<void>();

  portfolio = signal<Portfolio>({
    cash: this.initialCash,
    equity: 0,
    totalValue: this.initialCash
  });

  positions = signal<Position[]>([]);
  tradeHistory = signal<Trade[]>([]);

  constructor(@Inject(PLATFORM_ID) private platformId: any) {
    if (!isPlatformServer(this.platformId)) {
      console.log('PortfolioService initialized');
    }
  }

  initializePortfolio(initialCash: number) {
    this.initialCash = initialCash;
    this.resetPortfolio();
  }

  getPortfolio(): Portfolio {
    return this.portfolio();
  }

  getPortfolioUpdated(): Observable<void> {
    return this.portfolioUpdated.asObservable();
  }

  currentPositions(): Position[] {
    return this.positions();
  }

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
      : entryPrice * quantity * 2;

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
      stopLoss: stopLoss ?? this.calculateStopLoss(entryPrice, direction),
      takeProfit: takeProfit ?? this.calculateTakeProfit(entryPrice, direction),
      entryTime: Date.now()
    };

    this.positions.update(positions => [...positions, newPosition]);

    this.portfolio.update(current => ({
      ...current,
      cash: current.cash - requiredCash,
      equity: current.equity + (direction === 'LONG' ? entryPrice * quantity : 0),
      totalValue: current.cash - requiredCash + current.equity
    }));

    console.log(`Opened ${direction} position for ${symbol}`, newPosition);
    return true;
  }

  closePosition(symbol: string, exitPrice: number): void {
  const positionIndex = this.positions().findIndex(p => p.symbol === symbol);
  if (positionIndex === -1) return;

  const position = this.positions()[positionIndex];
  const pnl = position.direction === 'LONG'
    ? (exitPrice - position.entryPrice) * position.quantity
    : (position.entryPrice - exitPrice) * position.quantity;

  const pnlPercent = (pnl / (position.entryPrice * position.quantity)) * 100;

  const updatedTrade: Trade = {
    symbol,
    quantity: position.quantity,
    direction: position.direction,
    entryPrice: position.entryPrice,
    exitPrice,
    pnl,
    pnlPercent, // ✅ Aggiungi questa riga
    fee: 0,
    status: 'CLOSED',
    timestamp: Date.now()
  };

  this.addTrade(updatedTrade);

  const updatedPositions = [...this.positions()];
  updatedPositions.splice(positionIndex, 1);
  this.positions.set(updatedPositions);

  const cashBack = position.direction === 'LONG'
    ? exitPrice * position.quantity
    : position.entryPrice * position.quantity * 2;

  this.portfolio.update(current => ({
    ...current,
    cash: current.cash + cashBack,
    equity: current.equity - (position.currentPrice * position.quantity),
    totalValue: current.cash + cashBack + current.equity - (position.currentPrice * position.quantity)
  }));
}

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

    this.updatePortfolioValue();
  }

  
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

  private calculateStopLoss(entryPrice: number, direction: 'LONG' | 'SHORT'): number {
    const stopLossPercent = 0.02;
    return direction === 'LONG'
      ? entryPrice * (1 - stopLossPercent)
      : entryPrice * (1 + stopLossPercent);
  }

  private calculateTakeProfit(entryPrice: number, direction: 'LONG' | 'SHORT'): number {
    const takeProfitPercent = 0.04;
    return direction === 'LONG'
      ? entryPrice * (1 + takeProfitPercent)
      : entryPrice * (1 - takeProfitPercent);
  }

  async closePositionWithSimulator(symbol: string, reason: string): Promise<boolean> {
    const position = this.positions().find(p => p.symbol === symbol);

    if (!position) {
      console.warn(`Position not found for symbol: ${symbol}`);
      return false;
    }

    this.closePosition(symbol, position.currentPrice);

    console.log(`Closed position for ${symbol} due to: ${reason}`);
    return true;
  }

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