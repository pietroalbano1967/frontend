import { Injectable, signal, computed, inject } from '@angular/core';
import { TradingDecision, TradingDecisionService } from './trading-decision.service';
import { RiskManagementService } from './risk-management.service';
import { BinanceApiService, MiniTicker } from './binance-api.service';
import { AlertService } from './alert.service';
import { NotificationService } from './notification.service';
import { RiskCalculator } from '../utils/risk-calculator';
import { TradingSimulatorService } from './trading-simulator.service';
export interface Position {
  symbol: string;
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  stopLoss: number;
  takeProfit: number;
  entryTime: Date;
  direction: 'LONG' | 'SHORT';
  status: 'OPEN' | 'CLOSED';
  riskRewardRatio: number;
}

export interface Trade {
  id: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  pnlPercent: number;
  entryTime: Date;
  exitTime: Date;
  duration: number; // in minutes
  reason: string;
  riskRewardRatio: number;
}

export interface PerformanceStats {
  totalProfit: number;
  totalLoss: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  dailyReturn: number;
  monthlyReturn: number;
  annualReturn: number;
  volatility: number;
  bestTrade: number;
  worstTrade: number;
  averageTrade: number;
  expectancy: number;
}

export interface RiskMetrics {
  var95: number; // Value at Risk 95%
  expectedShortfall: number;
  beta: number;
  alpha: number;
  sortinoRatio: number;
  calmarRatio: number;
  valueAtRisk: number;
}

export interface DiversificationAnalysis {
  sectorExposure: Map<string, number>;
  positionConcentration: number;
  correlationMatrix: Map<string, Map<string, number>>;
  diversificationScore: number;
}

export interface Portfolio {
  totalValue: number;
  initialCapital: number;
  cash: number;
  equity: number;
  positions: Position[];
  performance: PerformanceStats;
  riskMetrics: RiskMetrics;
  diversification: DiversificationAnalysis;
}

export interface OptimizationResult {
  optimalWeights: Map<string, number>;
  expectedReturn: number;
  expectedRisk: number;
  sharpeRatio: number;
}

@Injectable({ providedIn: 'root' })
export class PortfolioService {
  private tradingService = inject(TradingDecisionService);
  private riskService = inject(RiskManagementService);
  private binanceApi = inject(BinanceApiService);
  private alertService = inject(AlertService);
  private notificationService = inject(NotificationService);
  private tradingSimulator = inject(TradingSimulatorService);
  private portfolio = signal<Portfolio>(this.initializePortfolio());
  private tradeHistory = signal<Trade[]>([]);
  private positionHistory = signal<Position[]>([]);

  // Computed properties
  currentPositions = computed(() => 
    this.portfolio().positions.filter(p => p.status === 'OPEN')
  );

  closedPositions = computed(() => 
    this.portfolio().positions.filter(p => p.status === 'CLOSED')
  );

  totalPnL = computed(() => this.portfolio().performance.totalProfit + this.portfolio().performance.totalLoss);
  equityCurve = computed(() => this.calculateEquityCurve());

  constructor() {
    this.setupPriceUpdates();
    this.setupAutoMonitoring();
  }

  private initializePortfolio(): Portfolio {
    const initialCapital = 10000; // $10,000 starting capital
    
    return {
      totalValue: initialCapital,
      initialCapital,
      cash: initialCapital,
      equity: initialCapital,
      positions: [],
      performance: {
        totalProfit: 0,
        totalLoss: 0,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        profitFactor: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        maxDrawdownPercent: 0,
        dailyReturn: 0,
        monthlyReturn: 0,
        annualReturn: 0,
        volatility: 0,
        bestTrade: 0,
        worstTrade: 0,
        averageTrade: 0,
        expectancy: 0
      },
      riskMetrics: {
        var95: 0,
        expectedShortfall: 0,
        beta: 0,
        alpha: 0,
        sortinoRatio: 0,
        calmarRatio: 0,
        valueAtRisk: 0
      },
      diversification: {
        sectorExposure: new Map(),
        positionConcentration: 0,
        correlationMatrix: new Map(),
        diversificationScore: 0
      }
    };
  }

  private setupPriceUpdates() {
    // Sottoscrizione agli aggiornamenti dei prezzi
    this.binanceApi.connectWS('', 'miniTicker').subscribe({
      next: (message) => {
        if (message.type === 'miniTicker') {
          this.updatePositionPrices(message.payload as MiniTicker);
        }
      }
    });
  }

  private setupAutoMonitoring() {
    // Monitoraggio automatico ogni 30 secondi
    setInterval(() => {
      this.checkStopLosses();
      this.checkTakeProfits();
      this.updatePerformance();
    }, 30000);
  }

  // METODI PRINCIPALI
   // Sostituisci executeTrade con simulateTrade
  async simulateTrade(decision: TradingDecision): Promise<boolean> {
    try {
      if (!this.validateTrade(decision)) {
        throw new Error('Trade non valido secondo risk management');
      }

      const positionSize = this.calculatePositionSize(decision);
      const entryPrice = decision.entryPrice || await this.getCurrentPrice(decision.symbol);
      
      // Usa il simulatore invece di operazioni reali
      const executionResult = await this.tradingSimulator.simulateOrder(decision).toPromise();
      
      if (!executionResult?.success) {
        throw new Error(executionResult?.message || 'Simulated order failed');
      }

      const position: Position = {
        symbol: decision.symbol,
        quantity: positionSize / executionResult.executedPrice,
        entryPrice: executionResult.executedPrice, // Usa il prezzo eseguito
        currentPrice: executionResult.executedPrice,
        pnl: 0,
        pnlPercent: 0,
        stopLoss: decision.stopLoss || this.calculateStopLoss(decision, executionResult.executedPrice),
        takeProfit: decision.takeProfit || this.calculateTakeProfit(decision, executionResult.executedPrice),
        entryTime: new Date(),
        direction: decision.decision === 'LONG' ? 'LONG' : 'SHORT',
        status: 'OPEN',
        riskRewardRatio: decision.riskRewardRatio
      };

      // ... resto del codice invariato ...
      
      this.notificationService.addNotification({
        type: 'success',
        title: `✅ Simulated Trade: ${decision.symbol}`,
        message: `SIMULATION - ${position.direction} - Entry: $${executionResult.executedPrice.toFixed(2)}`
      });

      return true;

    } catch (error) {
      console.error('Errore simulazione trade:', error);
      this.notificationService.addNotification({
        type: 'error',
        title: `❌ Simulated Trade Failed: ${decision.symbol}`,
        message: error instanceof Error ? error.message : 'Errore di simulazione'
      });
      return false;
    }
  }


  closePosition(symbol: string, reason: string = 'Manual close'): boolean {
    const position = this.currentPositions().find(p => p.symbol === symbol);
    if (!position) return false;

    const currentPrice = position.currentPrice;
    const pnl = position.direction === 'LONG' 
      ? (currentPrice - position.entryPrice) * position.quantity
      : (position.entryPrice - currentPrice) * position.quantity;

    // Aggiorna portfolio
    // Sostituisci le righe 275-287 con:
this.portfolio.update(current => {
  const newPositions = current.positions.map(p =>
    p.symbol === symbol ? { 
      ...p, 
      status: 'CLOSED' as const // Specifica il tipo literal
    } : p
  );
  
  const newCash = current.cash + (position.quantity * currentPrice);
  const realizedPnl = pnl;

  return {
    ...current,
    cash: newCash,
    positions: newPositions,
    totalValue: newCash + this.calculatePositionsValue(newPositions),
    performance: this.updatePerformanceStats(current.performance, realizedPnl, pnl > 0)
  };
});

    // Aggiorna trade history
    this.updateTradeHistory(symbol, currentPrice, reason, pnl);

    this.notificationService.addNotification({
      type: 'info',
      title: `📊 Position Closed: ${symbol}`,
      message: `PnL: $${pnl.toFixed(2)} (${((pnl / (position.quantity * position.entryPrice)) * 100).toFixed(2)}%) - Reason: ${reason}`
    });

    return true;
  }

  // METODI DI SUPPORTO
  private validateTrade(decision: TradingDecision): boolean {
    const riskValidation = this.riskService.canExecuteTrade(decision, this.portfolio());
    const sufficientCash = this.portfolio().cash >= this.calculatePositionSize(decision);
    const existingPosition = this.currentPositions().some(p => p.symbol === decision.symbol);

    return riskValidation && sufficientCash && !existingPosition;
  }

 private calculatePositionSize(decision: TradingDecision): number {
  // Crea un metodo pubblico in RiskManagementService o usa un valore fisso
  const riskPerTrade = 0.02; // 2% risk per trade (valore fisso per ora)
  return this.portfolio().totalValue * riskPerTrade;
}

  private calculateStopLoss(decision: TradingDecision, entryPrice: number): number {
    const volatility = 0.02; // 2% volatility
    const risk = decision.confidence > 0.7 ? 0.01 : 0.02;
    
    return decision.decision === 'LONG' 
      ? entryPrice * (1 - risk)
      : entryPrice * (1 + risk);
  }

  private calculateTakeProfit(decision: TradingDecision, entryPrice: number): number {
    const reward = decision.riskRewardRatio * 0.01; // Base 1% risk
    return decision.decision === 'LONG'
      ? entryPrice * (1 + reward)
      : entryPrice * (1 - reward);
  }

  private updatePositionPrices(ticker: MiniTicker) {
    this.portfolio.update(current => {
      const newPositions = current.positions.map(position => {
        if (position.symbol === ticker.symbol && position.status === 'OPEN') {
          const newPrice = ticker.last_price;
          const pnl = position.direction === 'LONG'
            ? (newPrice - position.entryPrice) * position.quantity
            : (position.entryPrice - newPrice) * position.quantity;
          
          return {
            ...position,
            currentPrice: newPrice,
            pnl,
            pnlPercent: (pnl / (position.quantity * position.entryPrice)) * 100
          };
        }
        return position;
      });

      return {
        ...current,
        positions: newPositions,
        equity: current.cash + this.calculatePositionsValue(newPositions),
        totalValue: current.cash + this.calculatePositionsValue(newPositions)
      };
    });
  }

  private checkStopLosses() {
    this.currentPositions().forEach(position => {
      if (this.shouldCloseByStopLoss(position)) {
        this.closePosition(position.symbol, 'Stop Loss triggered');
      }
    });
  }

  private checkTakeProfits() {
    this.currentPositions().forEach(position => {
      if (this.shouldCloseByTakeProfit(position)) {
        this.closePosition(position.symbol, 'Take Profit reached');
      }
    });
  }

  private shouldCloseByStopLoss(position: Position): boolean {
    return position.direction === 'LONG'
      ? position.currentPrice <= position.stopLoss
      : position.currentPrice >= position.stopLoss;
  }

  private shouldCloseByTakeProfit(position: Position): boolean {
    return position.direction === 'LONG'
      ? position.currentPrice >= position.takeProfit
      : position.currentPrice <= position.takeProfit;
  }

  // PERFORMANCE ANALYSIS
  private updatePerformance() {
    this.portfolio.update(current => {
      const performance = this.calculatePerformanceMetrics(current.positions, this.tradeHistory());
      const riskMetrics = this.calculateRiskMetrics();
      const diversification = this.analyzeDiversification();

      return {
        ...current,
        performance,
        riskMetrics,
        diversification
      };
    });
  }

  private calculatePerformanceMetrics(positions: Position[], trades: Trade[]): PerformanceStats {
    const closedTrades = trades.filter(t => t.exitPrice > 0);
    const winningTrades = closedTrades.filter(t => t.pnl > 0);
    const losingTrades = closedTrades.filter(t => t.pnl <= 0);

    const totalProfit = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
    const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
    const winRate = closedTrades.length > 0 ? winningTrades.length / closedTrades.length : 0;

    return {
      totalProfit,
      totalLoss,
      totalTrades: closedTrades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate,
      profitFactor: totalLoss > 0 ? totalProfit / totalLoss : totalProfit,
      sharpeRatio: this.calculateSharpeRatio(closedTrades),
      maxDrawdown: this.calculateMaxDrawdown(),
      maxDrawdownPercent: this.calculateMaxDrawdownPercent(),
      dailyReturn: this.calculateDailyReturn(),
      monthlyReturn: this.calculateMonthlyReturn(),
      annualReturn: this.calculateAnnualReturn(),
      volatility: this.calculateVolatility(closedTrades),
      bestTrade: Math.max(...closedTrades.map(t => t.pnl), 0),
      worstTrade: Math.min(...closedTrades.map(t => t.pnl), 0),
      averageTrade: closedTrades.reduce((sum, t) => sum + t.pnl, 0) / closedTrades.length || 0,
      expectancy: this.calculateExpectancy(winningTrades, losingTrades)
    };
  }

  // METODI DI UTILITY
  private calculatePositionsValue(positions: Position[]): number {
    return positions
      .filter(p => p.status === 'OPEN')
      .reduce((sum, p) => sum + (p.quantity * p.currentPrice), 0);
  }

  private generateTradeId(): string {
    return `TRADE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private addToTradeHistory(trade: Trade) {
    this.tradeHistory.update(history => [...history, trade]);
  }

  private updateTradeHistory(symbol: string, exitPrice: number, reason: string, pnl: number) {
    this.tradeHistory.update(history =>
      history.map(trade =>
        trade.symbol === symbol && trade.exitPrice === 0
          ? {
              ...trade,
              exitPrice,
              pnl,
              pnlPercent: (pnl / (trade.quantity * trade.entryPrice)) * 100,
              exitTime: new Date(),
              duration: (new Date().getTime() - trade.entryTime.getTime()) / 60000,
              reason
            }
          : trade
      )
    );
  }

  private updatePerformanceStats(stats: PerformanceStats, pnl: number, isWin: boolean): PerformanceStats {
    return {
      ...stats,
      totalProfit: stats.totalProfit + (isWin ? pnl : 0),
      totalLoss: stats.totalLoss + (!isWin ? Math.abs(pnl) : 0),
      totalTrades: stats.totalTrades + 1,
      winningTrades: stats.winningTrades + (isWin ? 1 : 0),
      losingTrades: stats.losingTrades + (!isWin ? 1 : 0),
      winRate: (stats.winningTrades + (isWin ? 1 : 0)) / (stats.totalTrades + 1)
    };
  }

  // METODI PUBBLICI
  getPortfolio(): Portfolio {
    return this.portfolio();
  }

  getTradeHistory(): Trade[] {
    return this.tradeHistory();
  }

  getCurrentPerformance(): PerformanceStats {
    return this.portfolio().performance;
  }

  resetPortfolio(): void {
    this.portfolio.set(this.initializePortfolio());
    this.tradeHistory.set([]);
    this.positionHistory.set([]);
  }

  exportPortfolioData(): string {
    return JSON.stringify({
      portfolio: this.portfolio(),
      tradeHistory: this.tradeHistory(),
      performance: this.portfolio().performance
    }, null, 2);
  }

  // METODI DI ANALISI (implementazioni semplificate)
  private calculateSharpeRatio(trades: Trade[]): number {
    if (trades.length < 2) return 0;
    const returns = trades.map(t => t.pnlPercent / 100);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdDev = Math.sqrt(returns.map(r => Math.pow(r - avgReturn, 2)).reduce((a, b) => a + b, 0) / returns.length);
    return stdDev > 0 ? avgReturn / stdDev * Math.sqrt(252) : 0;
  }

  private calculateMaxDrawdown(): number {
    // Implementazione semplificata
    return 0;
  }

  private calculateMaxDrawdownPercent(): number {
    return 0;
  }

  private calculateDailyReturn(): number {
    return 0;
  }

  private calculateMonthlyReturn(): number {
    return 0;
  }

  private calculateAnnualReturn(): number {
    return 0;
  }

  private calculateVolatility(trades: Trade[]): number {
    if (trades.length < 2) return 0;
    const returns = trades.map(t => t.pnlPercent / 100);
    return Math.sqrt(returns.map(r => Math.pow(r - this.mean(returns), 2)).reduce((a, b) => a + b, 0) / returns.length);
  }

  private calculateExpectancy(winningTrades: Trade[], losingTrades: Trade[]): number {
    if (winningTrades.length + losingTrades.length === 0) return 0;
    
    const avgWin = winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length || 0;
    const avgLoss = losingTrades.reduce((sum, t) => sum + Math.abs(t.pnl), 0) / losingTrades.length || 0;
    const winRate = winningTrades.length / (winningTrades.length + losingTrades.length);
    
    return (winRate * avgWin) - ((1 - winRate) * avgLoss);
  }

  private mean(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private calculateRiskMetrics(): RiskMetrics {
    // Implementazione semplificata
    return {
      var95: 0,
      expectedShortfall: 0,
      beta: 0,
      alpha: 0,
      sortinoRatio: 0,
      calmarRatio: 0,
      valueAtRisk: 0
    };
  }

  private analyzeDiversification(): DiversificationAnalysis {
    // Implementazione semplificata
    return {
      sectorExposure: new Map(),
      positionConcentration: 0,
      correlationMatrix: new Map(),
      diversificationScore: 0
    };
  }

  private calculateEquityCurve(): number[] {
    // Implementazione semplificata
    return [];
  }

  private async getCurrentPrice(symbol: string): Promise<number> {
    const tickers = await this.binanceApi.latestMini([symbol]).toPromise();
    return tickers?.[0]?.last_price || 0;
  }
}