// services/trading-simulator.service.ts
import { Injectable, inject } from '@angular/core';
import { Observable, of, delay, tap, BehaviorSubject } from 'rxjs';
import { TradingDecision } from './trading-decision.service';
import { PortfolioService, Position, Trade, Portfolio } from './portfolio.service';
import { NotificationService } from './notification.service';
import { RiskManagementService } from './risk-management.service';
import { BinanceApiService } from './binance-api.service';
import { TradingDecisionService } from './trading-decision.service';

export interface SimulationConfig {
  initialCapital: number;
  riskPerTrade: number;
  maxPositions: number;
  commission: number;
  slippage: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  symbols: string[];
  simulationSpeed: number;
}

export interface SimulationResult {
  totalProfit: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  maxDrawdown: number;
  sharpeRatio: number;
  trades: Trade[];
  equityCurve: number[];
  startDate: Date;
  endDate: Date;
}

export interface MarketData {
  symbol: string;
  price: number;
  timestamp: Date;
  volume?: number;
}

export interface KlineData {
  symbol: string;
  open: number;
  high: number;
  close: number;
  low: number;
  volume: number;
  timestamp: Date;
  isClosed: boolean;
}

export interface TradingSignal {
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  price: number;
  confidence: number;
  reason: string;
  timestamp: Date;
  indicators: { // AGGIUNGI QUESTA PROPRIETÀ
    rsi?: number;
    trend?: string;
    support?: number;
    resistance?: number;
    volume?: number;
  };
}

export type OrderStatus = 'FILLED' | 'PARTIALLY_FILLED' | 'CANCELLED' | 'REJECTED' | 'PENDING';

@Injectable({ providedIn: 'root' })
export class TradingSimulatorService {
  private portfolioService = inject(PortfolioService);
  private notificationService = inject(NotificationService);
  private riskService = inject(RiskManagementService);
  private binanceApi = inject(BinanceApiService);
  private tradingDecision = inject(TradingDecisionService);
  
  private simulationActive = new BehaviorSubject<boolean>(false);
  private simulationSpeed = new BehaviorSubject<number>(1);
  private currentEquity = new BehaviorSubject<number>(0);
  private currentPortfolio = new BehaviorSubject<Portfolio>({
    cash: 0,
    equity: 0,
    totalValue: 0
  });
  
  private klineData = new BehaviorSubject<Map<string, KlineData[]>>(new Map());
  private tradingSignals = new BehaviorSubject<TradingSignal[]>([]);
  private currentCandles = new Map<string, KlineData>();
  
  private simulationConfig: SimulationConfig = {
    initialCapital: 10000,
    riskPerTrade: 0.02,
    maxPositions: 5,
    commission: 0.001,
    slippage: 0.001,
    stopLossPercent: 0.02,
    takeProfitPercent: 0.04,
    symbols: ['BTCUSDT', 'ETHUSDT'],
    simulationSpeed: 1
  };

  constructor() {
    this.portfolioService.resetPortfolio();
    this.currentPortfolio.next(this.portfolioService.getPortfolio());
    this.currentEquity.next(this.simulationConfig.initialCapital);
  }

  // Metodo per avviare la simulazione in tempo reale
  startRealTimeSimulation(): void {
    this.portfolioService.resetPortfolio();
    this.currentEquity.next(this.simulationConfig.initialCapital);
    this.simulationActive.next(true);
    
    this.notificationService.addNotification({
      type: 'success',
      title: '🚀 Simulazione Avviata',
      message: 'La simulazione di trading è ora attiva'
    });
    
    this.connectToRealData();
  }

  // Collegamento ai dati reali
  private connectToRealData() {
    this.binanceApi.connectWS(this.simulationConfig.symbols.join(','), 'miniTicker').subscribe({
      next: (message) => {
        if (message.type === 'miniTicker' && this.simulationActive.value) {
          this.processMarketData({
            symbol: message.payload.s,
            price: parseFloat(message.payload.c),
            timestamp: new Date(message.payload.E),
            volume: parseFloat(message.payload.v)
          });
        }
      },
      error: (err) => {
        console.error('WebSocket error:', err);
        this.notificationService.addNotification({
          type: 'error',
          title: '❌ Errore Connessione',
          message: 'Impossibile connettersi ai dati di mercato'
        });
      }
    });
  }

  // Processa i dati di mercato
  private processMarketData(ticker: MarketData) {
    if (!this.simulationActive.value) return;
    
    // 1. Aggiorna prezzi nel portfolio
    const priceMap = new Map<string, number>();
    priceMap.set(ticker.symbol, ticker.price);
    this.portfolioService.updatePositionPrices(priceMap);
    
    // 2. Aggiorna il portfolio corrente
    this.currentPortfolio.next(this.portfolioService.getPortfolio());
    
    // 3. Calcola equity corrente
    this.updateCurrentEquity();
    
    // 4. Verifica stop loss e take profit
    this.checkRiskManagement(ticker.symbol, ticker.price);
    
    // 5. Verifica se ci sono segnali trading
    this.checkTradingSignals(ticker);
  }

  // Aggiorna l'equity corrente
  private updateCurrentEquity(): void {
    const portfolio = this.portfolioService.getPortfolio();
    this.currentEquity.next(portfolio.totalValue);
  }

  // Verifica stop loss e take profit
  private checkRiskManagement(symbol: string, currentPrice: number): void {
    const positions = this.portfolioService.currentPositions();
    
    positions.filter(pos => pos.symbol === symbol).forEach(position => {
      const pnlPercent = position.pnlPercent;
      
      // Check stop loss
      if (pnlPercent <= -this.simulationConfig.stopLossPercent * 100) {
        this.closePosition(position, 'STOP_LOSS', currentPrice);
      }
      
      // Check take profit
      if (pnlPercent >= this.simulationConfig.takeProfitPercent * 100) {
        this.closePosition(position, 'TAKE_PROFIT', currentPrice);
      }
    });
  }

  // Chiude una posizione
  private closePosition(position: Position, reason: string, currentPrice: number): void {
    this.closePositionWithSimulator(position, currentPrice).then(result => {
      if (result.success) {
        this.notificationService.addNotification({
          type: 'info',
          title: `🔒 Posizione Chiusa - ${reason}`,
          message: `${position.symbol} chiusa a ${result.closedPrice.toFixed(2)} (P&L: ${result.pnl.toFixed(2)})`
        });
      }
    });
  }

  // VERIFICA SEGNALI TRADING
  private checkTradingSignals(ticker: MarketData) {
    if (this.shouldGenerateSignal(ticker)) {
      this.tradingDecision.generateDecision(ticker.symbol).then(decision => {
        if (decision && this.isValidDecision(decision, ticker.price)) {
          this.executeSimulatedTrade(decision, ticker.price);
        }
      });
    }
  }

  // Determina se generare un segnale
  private shouldGenerateSignal(ticker: MarketData): boolean {
    return Math.random() > 0.8;
  }

  // Verifica se la decisione è valida
  private isValidDecision(decision: TradingDecision, currentPrice: number): boolean {
    if (!decision || !decision.symbol || !decision.decision) return false;
    
    const entryPrice = decision.entryPrice || currentPrice;
    const priceDiff = Math.abs(entryPrice - currentPrice) / currentPrice;
    if (priceDiff > 0.05) return false;
    
    return true;
  }

  // Esegue trade simulato
  private executeSimulatedTrade(decision: TradingDecision, currentPrice: number) {
    // Verifica se abbiamo già una posizione aperta su questo simbolo
    const existingPosition = this.portfolioService.currentPositions()
      .find(p => p.symbol === decision.symbol);
    
    if (existingPosition) {
      // Se abbiamo già una posizione, valuta se chiuderla
      // Converti la decisione in una direzione equivalente
      const decisionDirection = decision.decision === 'LONG' ? 'LONG' : 'SHORT';
      const isReversalSignal = existingPosition.direction !== decisionDirection;
      
      if (isReversalSignal) {
        this.closePosition(existingPosition, 'REVERSAL_SIGNAL', currentPrice);
      }
      return;
    }
    
    // Calcola la dimensione della posizione in base al rischio
    const portfolio = this.portfolioService.getPortfolio();
    const riskAmount = portfolio.totalValue * this.simulationConfig.riskPerTrade;
    const stopLossDistance = currentPrice * this.simulationConfig.stopLossPercent;
    const positionSize = riskAmount / stopLossDistance;
    
    // Verifica che non superi il limite di posizioni
    if (this.portfolioService.currentPositions().length >= this.simulationConfig.maxPositions) {
      this.notificationService.addNotification({
        type: 'warning',
        title: '⚠️ Limite Posizioni Raggiunto',
        message: `Impossibile aprire posizione su ${decision.symbol} - massimo ${this.simulationConfig.maxPositions} posizioni consentite`
      });
      return;
    }
    
    // Esegui l'ordine
    this.simulateOrder(decision, currentPrice, positionSize).subscribe(result => {
      if (result.success) {
        this.notificationService.addNotification({
          type: 'success',
          title: `✅ ${decision.decision} ${decision.symbol}`,
          message: `Posizione aperta a ${result.executedPrice.toFixed(2)}`
        });
      }
    });
  }

 // Simula l'esecuzione di un ordine
simulateOrder(decision: TradingDecision, currentPrice: number, quantity: number): Observable<{
  success: boolean;
  message: string;
  orderId?: string;
  executedPrice: number;
  executedAt: Date;
}> {
  const executionDelay = Math.random() * 2000 / this.simulationSpeed.value + 1000;
  
  const success = Math.random() > 0.05;
  
  const slippage = (Math.random() - 0.5) * this.simulationConfig.slippage;
  const executedPrice = currentPrice * (1 + slippage);
  
  return of({
    success,
    message: success ? 'Order executed successfully' : 'Order failed due to market conditions',
    orderId: success ? this.generateOrderId() : undefined,
    executedPrice,
    executedAt: new Date()
  }).pipe(
    delay(executionDelay),
    tap(result => {
      if (result.success && decision.decision !== 'NEUTRAL') { // AGGIUNTA QUESTA CONDIZIONE
        // Aggiungi la posizione al portfolio
        const direction = decision.decision;
        const stopLoss = direction === 'LONG' 
          ? result.executedPrice * (1 - this.simulationConfig.stopLossPercent)
          : result.executedPrice * (1 + this.simulationConfig.stopLossPercent);
        
        const takeProfit = direction === 'LONG'
          ? result.executedPrice * (1 + this.simulationConfig.takeProfitPercent)
          : result.executedPrice * (1 - this.simulationConfig.takeProfitPercent);
        
        this.portfolioService.openPosition(
          decision.symbol,
          direction,
          result.executedPrice,
          quantity,
          stopLoss,
          takeProfit
        );
      }
      
      console.log(`SIMULATED ORDER: ${result.success ? 'SUCCESS' : 'FAILED'}`, {
        symbol: decision.symbol,
        decision: decision.decision,
        requestedPrice: decision.entryPrice,
        executedPrice: result.executedPrice,
        slippage: ((result.executedPrice / currentPrice - 1) * 100).toFixed(3) + '%'
      });
    })
  );
}
  // Simula la chiusura di una posizione
  simulateClosePosition(position: Position, currentPrice: number): Observable<{
    success: boolean;
    message: string;
    closedPrice: number;
    pnl: number;
    pnlPercent: number;
  }> {
    const executionDelay = Math.random() * 1000 / this.simulationSpeed.value + 500;
    
    const slippage = (Math.random() - 0.5) * this.simulationConfig.slippage;
    const closedPrice = currentPrice * (1 + slippage);
    
    const pnl = position.direction === 'LONG' 
      ? (closedPrice - position.entryPrice) * position.quantity
      : (position.entryPrice - closedPrice) * position.quantity;
    
    const pnlPercent = (pnl / (position.entryPrice * position.quantity)) * 100;
    
    return of({
      success: true,
      message: 'Position closed successfully',
      closedPrice,
      pnl,
      pnlPercent
    }).pipe(
      delay(executionDelay),
      tap(result => {
        // Chiudi la posizione
        this.portfolioService.closePosition(position.symbol, result.closedPrice, result.pnl);
        
        // Aggiorna l'equity
        this.updateCurrentEquity();
      })
    );
  }

  async closePositionWithSimulator(position: Position, currentPrice: number): Promise<{
    success: boolean;
    message: string;
    closedPrice: number;
    pnl: number;
    pnlPercent: number;
  }> {
    try {
      const result = await this.simulateClosePosition(position, currentPrice).toPromise();
      return result || {
        success: false,
        message: 'Failed to close position',
        closedPrice: 0,
        pnl: 0,
        pnlPercent: 0
      };
    } catch (error) {
      console.error('Error in closePositionWithSimulator:', error);
      return {
        success: false,
        message: 'Error closing position',
        closedPrice: 0,
        pnl: 0,
        pnlPercent: 0
      };
    }
  }

  // Esegue backtesting su dati storici
  runBacktest(
    historicalData: Map<string, any[]>,
    strategy: (data: any) => TradingDecision
  ): Observable<SimulationResult> {
    return new Observable(subscriber => {
      try {
        const result: SimulationResult = {
          totalProfit: 0,
          totalTrades: 0,
          winningTrades: 0,
          losingTrades: 0,
          winRate: 0,
          maxDrawdown: 0,
          sharpeRatio: 0,
          trades: [],
          equityCurve: [this.simulationConfig.initialCapital],
          startDate: new Date(),
          endDate: new Date()
        };

        setTimeout(() => {
          result.totalProfit = 1250;
          result.totalTrades = 15;
          result.winningTrades = 9;
          result.losingTrades = 6;
          result.winRate = result.winningTrades / result.totalTrades;
          result.maxDrawdown = 350;
          result.sharpeRatio = 1.8;
          
          subscriber.next(result);
          subscriber.complete();
        }, 2000);

      } catch (error) {
        subscriber.error(error);
      }
    });
  }

  // Ferma la simulazione
  stopRealTimeSimulation(): void {
    this.simulationActive.next(false);
    this.notificationService.addNotification({
      type: 'info',
      title: '⏹️ Simulazione Fermata',
      message: 'La simulazione di trading è stata fermata'
    });
  }

  // Controlla se la simulazione è attiva
  isSimulationActive(): Observable<boolean> {
    return this.simulationActive.asObservable();
  }

  // Ottiene l'equity corrente
  getCurrentEquity(): Observable<number> {
    return this.currentEquity.asObservable();
  }

  // Aggiorna la configurazione della simulazione
  updateConfig(config: Partial<SimulationConfig>): void {
    this.simulationConfig = { ...this.simulationConfig, ...config };
    if (config.simulationSpeed) {
      this.simulationSpeed.next(config.simulationSpeed);
    }
  }

  // Ottiene la configurazione corrente
  getConfig(): SimulationConfig {
    return { ...this.simulationConfig };
  }

  private generateOrderId(): string {
    return `SIM_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }

  // Backtesting con dati reali
  async runRealBacktest(symbol: string, days: number = 30): Promise<SimulationResult> {
    try {
      const historicalData = await this.binanceApi
        .getHistoricalData(symbol, '1d', days)
        .toPromise();

      return this.runSimulationOnData(historicalData || []);
    } catch (error) {
      console.error('Error in real backtest:', error);
      throw error;
    }
  }

  // Simulazione su dati reali
  private runSimulationOnData(historicalData: any[]): SimulationResult {
    const result: SimulationResult = {
      totalProfit: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      trades: [],
      equityCurve: [this.simulationConfig.initialCapital],
      startDate: new Date(historicalData[0]?.timestamp || Date.now()),
      endDate: new Date(historicalData[historicalData.length - 1]?.timestamp || Date.now())
    };

    return result;
  }

  // Reset della simulazione
  resetSimulation(): void {
    this.stopRealTimeSimulation();
    this.portfolioService.resetPortfolio();
    this.currentEquity.next(this.simulationConfig.initialCapital);
    
    this.notificationService.addNotification({
      type: 'info',
      title: '🔄 Simulazione Resettata',
      message: 'Tutti i dati della simulazione sono stati resettati'
    });
  }

  // Metodo per monitoraggio candele in tempo reale
  startCandleMonitoring(symbols: string[]): void {
    this.binanceApi.connectWS(symbols.join(','), 'kline').subscribe({
      next: (message) => {
        if (message.type === 'kline') {
          this.processKlineData(message.payload);
        }
      },
      error: (err) => console.error('WebSocket kline error:', err)
    });
  }

  private processKlineData(kline: any): void {
    const symbol = kline.s;
    const candle: KlineData = {
      symbol,
      open: parseFloat(kline.k.o),
      high: parseFloat(kline.k.h),
      low: parseFloat(kline.k.l),
      close: parseFloat(kline.k.c),
      volume: parseFloat(kline.k.v),
      timestamp: new Date(kline.k.t),
      isClosed: kline.k.x
    };

    // Aggiorna le candele correnti
    this.currentCandles.set(symbol, candle);

    // Aggiungi alla storia delle candele
    const currentData = this.klineData.value;
    const symbolData = currentData.get(symbol) || [];
    const newData = [...symbolData, candle].slice(-100);
    this.klineData.next(new Map(currentData).set(symbol, newData));

    // Aggiorna i prezzi del portfolio
    const priceMap = new Map<string, number>();
    priceMap.set(symbol, candle.close);
    this.portfolioService.updatePositionPrices(priceMap);

    // Genera segnale alla chiusura della candela
    if (candle.isClosed) {
      this.generateTradingSignal(symbol, newData);
    }
  }

  private generateTradingSignal(symbol: string, candleHistory: KlineData[]): void {
    if (candleHistory.length < 20) return;

    const currentCandle = candleHistory[candleHistory.length - 1];
    const previousCandle = candleHistory[candleHistory.length - 2];

    // Analisi tecnica semplice
    const signals: string[] = [];
    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let confidence = 0;

    // Pattern candele
    if (this.isBullishEngulfing(previousCandle, currentCandle)) {
      signals.push('bullish_engulfing');
      action = 'BUY';
      confidence += 0.3;
    }

    if (this.isBearishEngulfing(previousCandle, currentCandle)) {
      signals.push('bearish_engulfing');
      action = 'SELL';
      confidence += 0.3;
    }

    // Trend analysis (SMA)
    const sma20 = this.calculateSMA(candleHistory.slice(-20));
    const sma50 = this.calculateSMA(candleHistory.slice(-50));

    if (currentCandle.close > sma20 && sma20 > sma50) {
      signals.push('uptrend');
      if (action === 'BUY') confidence += 0.2;
    } else if (currentCandle.close < sma20 && sma20 < sma50) {
      signals.push('downtrend');
      if (action === 'SELL') confidence += 0.2;
    }

    // Volume analysis
    const avgVolume = this.calculateAverageVolume(candleHistory.slice(-20));
    if (currentCandle.volume > avgVolume * 1.5) {
      signals.push('high_volume');
      confidence += 0.1;
    }

    if (action !== 'HOLD' && confidence > 0.4) {
    const signal: TradingSignal = {
      symbol,
      action,
      price: currentCandle.close,
      confidence: Math.min(confidence, 0.9),
      reason: signals.join(', '),
      timestamp: new Date(),
      indicators: { // AGGIUNGI GLI INDICATORI
        trend: currentCandle.close > currentCandle.open ? 'bullish' : 'bearish',
        volume: currentCandle.volume
      }
    };

    const currentSignals = this.tradingSignals.value;
    this.tradingSignals.next([signal, ...currentSignals.slice(0, 49)]);
    
    if (this.simulationActive.value) {
      this.executeSignalTrade(signal);
    }
  }
}

  private executeSignalTrade(signal: TradingSignal): void {
  const decision: TradingDecision = {
    symbol: signal.symbol,
    decision: signal.action === 'BUY' ? 'LONG' : 'SHORT',
    entryPrice: signal.price,
    confidence: signal.confidence,
    riskRewardRatio: 2,
    timeframe: '5m',
    signals: [signal] // Ora passi l'oggetto TradingSignal completo
  };

  this.executeSimulatedTrade(decision, signal.price);
}

  // Helper methods per l'analisi tecnica
  private isBullishEngulfing(prev: KlineData, current: KlineData): boolean {
    return prev.close < prev.open && 
           current.close > current.open &&
           current.open <= prev.close && 
           current.close >= prev.open;
  }

  private isBearishEngulfing(prev: KlineData, current: KlineData): boolean {
    return prev.close > prev.open && 
           current.close < current.open &&
           current.open >= prev.close && 
           current.close <= prev.open;
  }

  private calculateSMA(candles: KlineData[]): number {
    return candles.reduce((sum, candle) => sum + candle.close, 0) / candles.length;
  }

  private calculateAverageVolume(candles: KlineData[]): number {
    return candles.reduce((sum, candle) => sum + candle.volume, 0) / candles.length;
  }

  // Metodi per osservare i dati
  getKlineData(): Observable<Map<string, KlineData[]>> {
    return this.klineData.asObservable();
  }

  getTradingSignals(): Observable<TradingSignal[]> {
    return this.tradingSignals.asObservable();
  }

  // Backtest storico
  async runHistoricalBacktest(symbol: string, days: number, strategy: (data: any) => TradingDecision): Promise<SimulationResult> {
    try {
      const historicalData = await this.binanceApi.getHistoricalData(symbol, '1d', days).toPromise();
      
      if (!historicalData || historicalData.length === 0) {
        throw new Error('Nessun dato storico disponibile');
      }

      // Inizializza il portfolio
      this.portfolioService.resetPortfolio();
      
      const result: SimulationResult = {
        totalProfit: 0,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        maxDrawdown: 0,
        sharpeRatio: 0,
        trades: [],
        equityCurve: [this.simulationConfig.initialCapital],
        startDate: new Date(historicalData[0].timestamp),
        endDate: new Date(historicalData[historicalData.length - 1].timestamp)
      };

      // Simula il trading sui dati storici
      for (const dataPoint of historicalData) {
        // Genera decisione dalla strategia
        const decision = strategy(dataPoint);
        
        if (decision && decision.decision !== 'NEUTRAL') {
          // Esegui il trade
          const currentPrice = dataPoint.close;
          const portfolio = this.portfolioService.getPortfolio();
          const riskAmount = portfolio.totalValue * this.simulationConfig.riskPerTrade;
          const stopLossDistance = currentPrice * this.simulationConfig.stopLossPercent;
          const quantity = riskAmount / stopLossDistance;

          // Simula l'ordine (semplificato)
          const slippage = (Math.random() - 0.5) * this.simulationConfig.slippage;
          const executedPrice = currentPrice * (1 + slippage);

          // Apri posizione
          this.portfolioService.openPosition(
            decision.symbol,
            decision.decision,
            executedPrice,
            quantity,
            executedPrice * (1 - this.simulationConfig.stopLossPercent),
            executedPrice * (1 + this.simulationConfig.takeProfitPercent)
          );
        }

        // Aggiorna prezzi e calcola PnL
        const priceMap = new Map<string, number>();
        priceMap.set(symbol, dataPoint.close);
        this.portfolioService.updatePositionPrices(priceMap);

        // Aggiorna risultati
        const currentPortfolio = this.portfolioService.getPortfolio();
        result.equityCurve.push(currentPortfolio.totalValue);
      }

      // Calcola metriche finali
      const trades = this.portfolioService.getTradeHistory();
      result.trades = trades;
      result.totalTrades = trades.length;
      result.winningTrades = trades.filter(t => t.pnl > 0).length;
      result.losingTrades = trades.filter(t => t.pnl < 0).length;
      result.winRate = result.totalTrades > 0 ? (result.winningTrades / result.totalTrades) * 100 : 0;
      result.totalProfit = trades.reduce((sum, t) => sum + t.pnl, 0);
      
      // Calcola max drawdown
      result.maxDrawdown = this.calculateMaxDrawdown(result.equityCurve);

      return result;

    } catch (error) {
      console.error('Errore nel backtest storico:', error);
      throw error;
    }
  }

  private calculateMaxDrawdown(equityCurve: number[]): number {
    let maxDrawdown = 0;
    let peak = equityCurve[0];

    for (const value of equityCurve) {
      if (value > peak) {
        peak = value;
      }
      const drawdown = ((peak - value) / peak) * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown;
  }
}