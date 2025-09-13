import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { PortfolioService } from './portfolio.service';
import { TradingDecisionService } from './trading-decision.service';
import { MarketData, Position, Trade } from '../types/binance.types';

@Injectable({
  providedIn: 'root'
})
export class TradingSimulatorService {
  readonly marketData = signal<MarketData | null>(null);
  readonly positions = signal<Position[]>([]);
  readonly isRunning = signal<boolean>(false);

  constructor(
    private http: HttpClient,
    private portfolioService: PortfolioService,
    private decisionService: TradingDecisionService
  ) {}

  startSimulation() {
    this.isRunning.set(true);
  }

  stopSimulation() {
    this.isRunning.set(false);
  }

  updateMarketData(data: MarketData) {
    this.marketData.set(data);
    this.processTradingDecision(data);
  }

  async processTradingDecision(data: MarketData) {
    try {
      const signal = await this.decisionService.generateTradingSignal(data.symbol, data.price);
      
      if (signal.action === 'BUY') {
        this.openPosition(data.symbol, data.price);
      } else if (signal.action === 'SELL') {
        await this.closePositionWithSimulator(data.symbol, data.price);
      }
    } catch (error) {
      console.error('Errore nel processare la decisione di trading:', error);
    }
  }

  openPosition(symbol: string, entryPrice: number) {
    const quantity = 1;
    
    // Usa il PortfolioService per aprire la posizione
    const success = this.portfolioService.openPosition(
      symbol,
      'LONG',
      entryPrice,
      quantity
    );
    
    if (success) {
      // Aggiungi anche alla lista interna delle posizioni del simulatore
      const newPosition: Position = {
        symbol,
        direction: 'LONG',
        entryPrice,
        currentPrice: entryPrice,
        quantity,
        pnl: 0,
        pnlPercent: 0,
        stopLoss: entryPrice * 0.98, // ESEMPIO: stop loss al 2%
        takeProfit: entryPrice * 1.04, // ESEMPIO: take profit al 4%
        entryTime: Date.now()
      };
      
      this.positions.update(positions => [...positions, newPosition]);
      console.log(`Posizione aperta per ${symbol} a ${entryPrice}`);
    }
  }

  closePosition(symbol: string, exitPrice: number) {
    const openPositions = this.positions();
    const index = openPositions.findIndex(p => p.symbol === symbol);
    if (index === -1) return;

    const [position] = openPositions.splice(index, 1);
    this.positions.set(openPositions);

    const pnl = (exitPrice - position.entryPrice) * position.quantity;
    const pnlPercent = (pnl / (position.entryPrice * position.quantity)) * 100;

    const trade: Trade = {
      symbol,
      quantity: position.quantity,
      direction: position.direction,
      entryPrice: position.entryPrice,
      exitPrice,
      pnl,
      pnlPercent,
      fee: 0,
      status: 'CLOSED',
      timestamp: Date.now()
    };

    this.portfolioService.addTrade(trade);
  }

  async closePositionWithSimulator(symbol: string, price: number): Promise<boolean> {
    try {
      this.closePosition(symbol, price);
      
      // Chiudi anche nel portfolio service
      this.portfolioService.closePosition(symbol, price);
      
      return true;
    } catch (error) {
      console.error('Errore nella chiusura della posizione:', error);
      return false;
    }
  }

  reset() {
    this.positions.set([]);
    this.marketData.set(null);
    this.isRunning.set(false);
  }

  getPositions(): Position[] {
    return this.positions();
  }

  getLatestMarketData(): MarketData | null {
    return this.marketData();
  }
}