// services/risk-management.service.ts
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class RiskManagementService {
  private maxPositionSize = 0.02; // 2% del portfolio per trade
  private maxDailyLoss = 0.05; // 5% massima perdita giornaliera
  private dailyProfit = 0;
  private dailyLoss = 0;

  calculatePositionSize(portfolioSize: number, riskPerTrade: number): number {
    return portfolioSize * Math.min(riskPerTrade, this.maxPositionSize);
  }

  canExecuteTrade(decision: any, portfolio: any): boolean {
    const risk = this.calculateRisk(decision);
    const positionSize = this.calculatePositionSize(portfolio.totalValue, risk);
    
    return positionSize > 0 && 
           this.dailyLoss < portfolio.totalValue * this.maxDailyLoss;
  }

  private calculateRisk(decision: any): number {
    // Calcola il rischio basato sulla confidence e R/R ratio
    const baseRisk = 0.01; // 1% base
    const confidenceMultiplier = decision.confidence;
    const rrMultiplier = Math.min(decision.riskRewardRatio / 2, 1);
    
    return baseRisk * confidenceMultiplier * rrMultiplier;
  }

  updateDailyPnL(profit: number) {
    if (profit > 0) {
      this.dailyProfit += profit;
    } else {
      this.dailyLoss += Math.abs(profit);
    }
  }

  resetDailyStats() {
    this.dailyProfit = 0;
    this.dailyLoss = 0;
  }
}