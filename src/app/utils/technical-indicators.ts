// utils/technical-indicators.ts
export interface IndicatorResult {
  value: number;
  signal: 'BUY' | 'SELL' | 'NEUTRAL';
  strength: number;
}

export class TechnicalIndicators {
  static calculateRSI(prices: number[], period: number = 14): IndicatorResult {
    if (prices.length < period + 1) {
      return { value: 50, signal: 'NEUTRAL', strength: 0 };
    }

    const gains: number[] = [];
    const losses: number[] = [];

    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }

    const avgGain = this.calculateEMA(gains, period);
    const avgLoss = this.calculateEMA(losses, period);

    const rs = avgGain / (avgLoss || 0.001); // Avoid division by zero
    const rsi = 100 - (100 / (1 + rs));

    let signal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
    let strength = 0;

    if (rsi < 30) {
      signal = 'BUY';
      strength = (30 - rsi) / 30;
    } else if (rsi > 70) {
      signal = 'SELL';
      strength = (rsi - 70) / 30;
    }

    return { value: rsi, signal, strength };
  }

  static calculateMACD(prices: number[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9): IndicatorResult {
    if (prices.length < slowPeriod + signalPeriod) {
      return { value: 0, signal: 'NEUTRAL', strength: 0 };
    }

    const fastEMA = this.calculateEMA(prices, fastPeriod);
    const slowEMA = this.calculateEMA(prices, slowPeriod);
    const macdLine = fastEMA - slowEMA;

    // Calculate signal line (EMA of MACD line)
    const signalLine = this.calculateEMA(prices.slice(-signalPeriod).map((_, i) => {
      const start = Math.max(0, prices.length - signalPeriod - i);
      return this.calculateEMA(prices.slice(start, start + fastPeriod), fastPeriod) - 
             this.calculateEMA(prices.slice(start, start + slowPeriod), slowPeriod);
    }), signalPeriod);

    const histogram = macdLine - signalLine;

    let signal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
    let strength = 0;

    if (macdLine > signalLine && histogram > 0) {
      signal = 'BUY';
      strength = Math.abs(histogram) / (prices[0] * 0.01);
    } else if (macdLine < signalLine && histogram < 0) {
      signal = 'SELL';
      strength = Math.abs(histogram) / (prices[0] * 0.01);
    }

    return { value: histogram, signal, strength };
  }

  static calculateBollingerBands(prices: number[], period: number = 20, multiplier: number = 2) {
    if (prices.length < period) {
      return { upper: 0, middle: 0, lower: 0, bandwidth: 0 };
    }

    const recentPrices = prices.slice(-period);
    const middle = this.calculateSMA(recentPrices);
    const stdDev = this.calculateStandardDeviation(recentPrices);

    const upper = middle + (multiplier * stdDev);
    const lower = middle - (multiplier * stdDev);
    const bandwidth = (upper - lower) / middle;

    return { upper, middle, lower, bandwidth };
  }

  static calculateStochasticOscillator(prices: number[], high: number[], low: number[], period: number = 14): IndicatorResult {
    if (prices.length < period || high.length < period || low.length < period) {
      return { value: 50, signal: 'NEUTRAL', strength: 0 };
    }

    const currentClose = prices[prices.length - 1];
    const periodHigh = Math.max(...high.slice(-period));
    const periodLow = Math.min(...low.slice(-period));

    const k = 100 * ((currentClose - periodLow) / (periodHigh - periodLow || 1));

    let signal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
    let strength = 0;

    if (k < 20) {
      signal = 'BUY';
      strength = (20 - k) / 20;
    } else if (k > 80) {
      signal = 'SELL';
      strength = (k - 80) / 20;
    }

    return { value: k, signal, strength };
  }

  static calculateATR(high: number[], low: number[], close: number[], period: number = 14): number {
    if (high.length < period || low.length < period || close.length < period) {
      return 0;
    }

    const trueRanges: number[] = [];
    
    for (let i = 1; i < high.length; i++) {
      const tr1 = high[i] - low[i];
      const tr2 = Math.abs(high[i] - close[i - 1]);
      const tr3 = Math.abs(low[i] - close[i - 1]);
      trueRanges.push(Math.max(tr1, tr2, tr3));
    }

    return this.calculateSMA(trueRanges.slice(-period));
  }

  static calculateVWAP(prices: number[], volumes: number[]): number {
    if (prices.length !== volumes.length || prices.length === 0) {
      return 0;
    }

    let cumulativePV = 0;
    let cumulativeVolume = 0;

    for (let i = 0; i < prices.length; i++) {
      cumulativePV += prices[i] * volumes[i];
      cumulativeVolume += volumes[i];
    }

    return cumulativePV / cumulativeVolume;
  }

  static calculateEMA(values: number[], period: number): number {
    if (values.length === 0) return 0;
    
    const k = 2 / (period + 1);
    let ema = values[0];

    for (let i = 1; i < values.length; i++) {
      ema = values[i] * k + ema * (1 - k);
    }

    return ema;
  }

  static calculateSMA(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  static calculateStandardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = this.calculateSMA(values);
    const squareDiffs = values.map(value => Math.pow(value - mean, 2));
    return Math.sqrt(this.calculateSMA(squareDiffs));
  }

  static detectSupportResistance(prices: number[], lookback: number = 20): { support: number[]; resistance: number[] } {
    if (prices.length < lookback) {
      return { support: [], resistance: [] };
    }

    const supportLevels: number[] = [];
    const resistanceLevels: number[] = [];
    const recentPrices = prices.slice(-lookback);

    for (let i = 3; i < recentPrices.length - 3; i++) {
      // Support detection (local minima)
      if (recentPrices[i] < recentPrices[i - 1] && 
          recentPrices[i] < recentPrices[i - 2] &&
          recentPrices[i] < recentPrices[i + 1] &&
          recentPrices[i] < recentPrices[i + 2]) {
        supportLevels.push(recentPrices[i]);
      }

      // Resistance detection (local maxima)
      if (recentPrices[i] > recentPrices[i - 1] && 
          recentPrices[i] > recentPrices[i - 2] &&
          recentPrices[i] > recentPrices[i + 1] &&
          recentPrices[i] > recentPrices[i + 2]) {
        resistanceLevels.push(recentPrices[i]);
      }
    }

    // Remove duplicates and sort
    return {
      support: [...new Set(supportLevels)].sort((a, b) => a - b),
      resistance: [...new Set(resistanceLevels)].sort((a, b) => b - a)
    };
  }

  static calculateTrendStrength(prices: number[], period: number = 10): number {
    if (prices.length < period) return 0;

    const recentPrices = prices.slice(-period);
    const x = recentPrices.map((_, i) => i);
    const y = recentPrices;

    // Simple linear regression
    const n = recentPrices.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((a, _, i) => a + x[i] * y[i], 0);
    const sumXX = x.reduce((a, b) => a + b * b, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const rSquared = Math.pow(
      (n * sumXY - sumX * sumY) / 
      Math.sqrt((n * sumXX - sumX * sumX) * (n * y.reduce((a, b) => a + b * b, 0) - sumY * sumY)),
      2
    );

    return Math.abs(slope) * rSquared;
  }
}