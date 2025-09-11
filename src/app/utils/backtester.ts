// utils/backtester.ts
export interface BacktestResult {
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  averageWin: number;
  averageLoss: number;
  expectancy: number;
  equityCurve: number[];
  drawdownCurve: number[];
  trades: TradeRecord[];
}

export interface TradeRecord {
  entryDate: Date;
  exitDate: Date;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  pnlPercent: number;
  holdPeriod: number; // in days
}

export interface BacktestConfig {
  initialCapital: number;
  riskPerTrade: number;
  commission: number;
  slippage: number;
  startDate: Date;
  endDate: Date;
}

export class Backtester {
  static runBacktest(
    historicalData: Map<string, any[]>,
    strategy: (data: any) => { signal: 'BUY' | 'SELL' | 'HOLD'; confidence: number },
    config: BacktestConfig
  ): BacktestResult {
    const results: BacktestResult = {
      totalReturn: 0,
      annualizedReturn: 0,
      volatility: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      winRate: 0,
      profitFactor: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      averageWin: 0,
      averageLoss: 0,
      expectancy: 0,
      equityCurve: [config.initialCapital],
      drawdownCurve: [0],
      trades: []
    };

    let currentCapital = config.initialCapital;
    let currentPosition: TradeRecord | null = null;
    const returns: number[] = [];

    // Iterate through historical data
    for (const [symbol, data] of historicalData) {
      for (let i = 1; i < data.length; i++) {
        const currentData = data[i];
        const previousData = data[i - 1];

        // Check if we have an open position
        if (currentPosition) {
          const currentPrice = currentData.close;
          const pnl = currentPosition.direction === 'LONG'
            ? (currentPrice - currentPosition.entryPrice) * currentPosition.quantity
            : (currentPosition.entryPrice - currentPrice) * currentPosition.quantity;

          // Check exit conditions
          const shouldExit = this.checkExitConditions(currentPosition, currentData, strategy);

          if (shouldExit) {
            this.closePosition(currentPosition, currentData, results, config);
            currentPosition = null;
          }
        } else {
          // Look for new entry signals
          const signal = strategy(currentData);
          
          if (signal.signal !== 'HOLD' && signal.confidence > 0.6) {
            currentPosition = this.openPosition(
              symbol,
              currentData,
              signal.signal,
              currentCapital,
              config
            );
          }
        }

        // Update equity curve
        const portfolioValue = currentCapital + (currentPosition ? this.calculatePositionValue(currentPosition, currentData.close) : 0);
        results.equityCurve.push(portfolioValue);
        
        // Calculate daily return
        const dailyReturn = (portfolioValue / results.equityCurve[results.equityCurve.length - 2] - 1);
        returns.push(dailyReturn);
      }
    }

    // Calculate final metrics
    this.calculateMetrics(results, returns, config);

    return results;
  }

  private static checkExitConditions(
    position: TradeRecord,
    currentData: any,
    strategy: (data: any) => { signal: 'BUY' | 'SELL' | 'HOLD'; confidence: number }
  ): boolean {
    const currentPrice = currentData.close;
    const currentSignal = strategy(currentData);

    // Check stop loss (2% for long, 2% for short)
    const stopLoss = position.direction === 'LONG'
      ? position.entryPrice * 0.98
      : position.entryPrice * 1.02;

    // Check take profit (4% for long, 4% for short)
    const takeProfit = position.direction === 'LONG'
      ? position.entryPrice * 1.04
      : position.entryPrice * 0.96;

    // Exit if opposite signal
    const oppositeSignal = position.direction === 'LONG' ? 'SELL' : 'BUY';
    
    return currentPrice <= stopLoss || 
           currentPrice >= takeProfit ||
           currentSignal.signal === oppositeSignal ||
           currentSignal.signal === 'HOLD';
  }

  private static openPosition(
    symbol: string,
    data: any,
    signal: 'BUY' | 'SELL',
    capital: number,
    config: BacktestConfig
  ): TradeRecord {
    const entryPrice = data.close * (1 + config.slippage);
    const positionSize = capital * config.riskPerTrade;
    const quantity = positionSize / entryPrice;

    return {
      entryDate: new Date(data.timestamp),
      exitDate: new Date(),
      symbol,
      direction: signal === 'BUY' ? 'LONG' : 'SHORT',
      entryPrice,
      exitPrice: 0,
      quantity,
      pnl: 0,
      pnlPercent: 0,
      holdPeriod: 0
    };
  }

  private static closePosition(
    position: TradeRecord,
    data: any,
    results: BacktestResult,
    config: BacktestConfig
  ) {
    const exitPrice = data.close * (1 - config.slippage);
    const pnl = position.direction === 'LONG'
      ? (exitPrice - position.entryPrice) * position.quantity
      : (position.entryPrice - exitPrice) * position.quantity;

    const pnlPercent = (pnl / (position.entryPrice * position.quantity)) * 100;
    const holdPeriod = (new Date(data.timestamp).getTime() - position.entryDate.getTime()) / (1000 * 60 * 60 * 24);

    const trade: TradeRecord = {
      ...position,
      exitDate: new Date(data.timestamp),
      exitPrice,
      pnl: pnl - config.commission,
      pnlPercent,
      holdPeriod
    };

    results.trades.push(trade);
    results.totalTrades++;

    if (trade.pnl > 0) {
      results.winningTrades++;
      results.averageWin = (results.averageWin * (results.winningTrades - 1) + trade.pnl) / results.winningTrades;
    } else {
      results.losingTrades++;
      results.averageLoss = (results.averageLoss * (results.losingTrades - 1) + Math.abs(trade.pnl)) / results.losingTrades;
    }
  }

  private static calculatePositionValue(position: TradeRecord, currentPrice: number): number {
    return position.quantity * currentPrice;
  }

  private static calculateMetrics(results: BacktestResult, returns: number[], config: BacktestConfig) {
    // Calculate basic metrics
    results.totalReturn = (results.equityCurve[results.equityCurve.length - 1] / config.initialCapital - 1) * 100;
    
    const days = (config.endDate.getTime() - config.startDate.getTime()) / (1000 * 60 * 60 * 24);
    results.annualizedReturn = (Math.pow(1 + results.totalReturn / 100, 365 / days) - 1) * 100;

    results.volatility = this.calculateVolatility(returns) * Math.sqrt(252) * 100;
    results.sharpeRatio = results.annualizedReturn / results.volatility;

    results.maxDrawdown = this.calculateMaxDrawdown(results.equityCurve) * 100;
    results.winRate = results.winningTrades / results.totalTrades;
    results.profitFactor = results.averageLoss > 0 ? (results.averageWin * results.winningTrades) / (results.averageLoss * results.losingTrades) : Infinity;
    results.expectancy = (results.winRate * results.averageWin) - ((1 - results.winRate) * results.averageLoss);

    // Calculate drawdown curve
    results.drawdownCurve = this.calculateDrawdownCurve(results.equityCurve);
  }

  private static calculateVolatility(returns: number[]): number {
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.map(r => Math.pow(r - mean, 2)).reduce((sum, v) => sum + v, 0) / returns.length;
    return Math.sqrt(variance);
  }

  private static calculateMaxDrawdown(equityCurve: number[]): number {
    let peak = equityCurve[0];
    let maxDrawdown = 0;

    for (const value of equityCurve) {
      if (value > peak) peak = value;
      const drawdown = (peak - value) / peak;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    return maxDrawdown;
  }

  private static calculateDrawdownCurve(equityCurve: number[]): number[] {
    let peak = equityCurve[0];
    return equityCurve.map(value => {
      if (value > peak) peak = value;
      return (peak - value) / peak;
    });
  }
}