// utils/risk-calculator.ts
export interface RiskParameters {
  positionSize: number;
  stopLoss: number;
  takeProfit: number;
  riskRewardRatio: number;
  riskAmount: number;
}

export interface PortfolioRisk {
  valueAtRisk: number;
  expectedShortfall: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  volatility: number;
}

export class RiskCalculator {
  static calculatePositionSize(
    accountSize: number,
    riskPerTrade: number,
    entryPrice: number,
    stopLossPrice: number
  ): RiskParameters {
    const riskAmount = accountSize * riskPerTrade;
    const riskPerShare = Math.abs(entryPrice - stopLossPrice);
    const positionSize = riskAmount / riskPerShare;
    const riskRewardRatio = this.calculateRiskRewardRatio(entryPrice, stopLossPrice);

    return {
      positionSize,
      stopLoss: stopLossPrice,
      takeProfit: entryPrice + (entryPrice - stopLossPrice) * riskRewardRatio,
      riskRewardRatio,
      riskAmount
    };
  }

  static calculateRiskRewardRatio(entryPrice: number, stopLossPrice: number, takeProfitPrice?: number): number {
    const risk = Math.abs(entryPrice - stopLossPrice);
    
    if (takeProfitPrice) {
      const reward = Math.abs(takeProfitPrice - entryPrice);
      return reward / risk;
    }

    // Default 1:2 risk reward if no take profit specified
    return 2.0;
  }

  static calculateKellyCriterion(winRate: number, winLossRatio: number): number {
    return winRate - ((1 - winRate) / winLossRatio);
  }

  static calculateValueAtRisk(
    returns: number[],
    confidenceLevel: number = 0.95
  ): number {
    if (returns.length === 0) return 0;

    const sortedReturns = [...returns].sort((a, b) => a - b);
    const index = Math.floor((1 - confidenceLevel) * sortedReturns.length);
    return sortedReturns[index];
  }

  static calculateExpectedShortfall(returns: number[], confidenceLevel: number = 0.95): number {
    if (returns.length === 0) return 0;

    const varThreshold = this.calculateValueAtRisk(returns, confidenceLevel);
    const tailReturns = returns.filter(r => r <= varThreshold);
    
    return tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length;
  }

  static calculateSharpeRatio(returns: number[], riskFreeRate: number = 0.02): number {
    if (returns.length === 0) return 0;

    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const volatility = this.calculateVolatility(returns);
    
    return volatility > 0 ? (avgReturn - riskFreeRate) / volatility : 0;
  }

  static calculateSortinoRatio(returns: number[], riskFreeRate: number = 0.02): number {
    if (returns.length === 0) return 0;

    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const downsideReturns = returns.filter(r => r < riskFreeRate);
    const downsideDeviation = downsideReturns.length > 0 
      ? Math.sqrt(downsideReturns.map(r => Math.pow(r - riskFreeRate, 2)).reduce((a, b) => a + b, 0) / downsideReturns.length)
      : 0;

    return downsideDeviation > 0 ? (avgReturn - riskFreeRate) / downsideDeviation : 0;
  }

  static calculateVolatility(returns: number[]): number {
    if (returns.length === 0) return 0;

    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.map(r => Math.pow(r - mean, 2)).reduce((sum, v) => sum + v, 0) / returns.length;
    
    return Math.sqrt(variance);
  }

  static calculateMaxDrawdown(equityCurve: number[]): number {
    if (equityCurve.length === 0) return 0;

    let peak = equityCurve[0];
    let maxDrawdown = 0;

    for (const value of equityCurve) {
      if (value > peak) {
        peak = value;
      }
      const drawdown = (peak - value) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown;
  }

  static calculateCorrelation(returns1: number[], returns2: number[]): number {
    if (returns1.length !== returns2.length || returns1.length === 0) return 0;

    const mean1 = returns1.reduce((sum, r) => sum + r, 0) / returns1.length;
    const mean2 = returns2.reduce((sum, r) => sum + r, 0) / returns2.length;

    let covariance = 0;
    let variance1 = 0;
    let variance2 = 0;

    for (let i = 0; i < returns1.length; i++) {
      covariance += (returns1[i] - mean1) * (returns2[i] - mean2);
      variance1 += Math.pow(returns1[i] - mean1, 2);
      variance2 += Math.pow(returns2[i] - mean2, 2);
    }

    covariance /= returns1.length;
    variance1 = Math.sqrt(variance1 / returns1.length);
    variance2 = Math.sqrt(variance2 / returns2.length);

    return variance1 > 0 && variance2 > 0 ? covariance / (variance1 * variance2) : 0;
  }

  static calculateBeta(assetReturns: number[], marketReturns: number[]): number {
    if (assetReturns.length !== marketReturns.length || assetReturns.length === 0) return 0;

    const covariance = this.calculateCovariance(assetReturns, marketReturns);
    const marketVariance = this.calculateVariance(marketReturns);

    return marketVariance > 0 ? covariance / marketVariance : 0;
  }

  static calculateAlpha(assetReturns: number[], marketReturns: number[], riskFreeRate: number = 0.02): number {
    const beta = this.calculateBeta(assetReturns, marketReturns);
    const assetAvgReturn = assetReturns.reduce((sum, r) => sum + r, 0) / assetReturns.length;
    const marketAvgReturn = marketReturns.reduce((sum, r) => sum + r, 0) / marketReturns.length;

    return assetAvgReturn - (riskFreeRate + beta * (marketAvgReturn - riskFreeRate));
  }

  private static calculateCovariance(returns1: number[], returns2: number[]): number {
    if (returns1.length !== returns2.length || returns1.length === 0) return 0;

    const mean1 = returns1.reduce((sum, r) => sum + r, 0) / returns1.length;
    const mean2 = returns2.reduce((sum, r) => sum + r, 0) / returns2.length;

    return returns1.reduce((sum, r, i) => sum + (r - mean1) * (returns2[i] - mean2), 0) / returns1.length;
  }

  private static calculateVariance(returns: number[]): number {
    if (returns.length === 0) return 0;

    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    return returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  }
}