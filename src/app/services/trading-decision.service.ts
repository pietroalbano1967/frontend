// services/trading-decision.service.ts
import { Injectable, inject } from '@angular/core';
import { AnalyticsService, PriceAnalysis } from './analytics.service';
import { AlertService } from './alert.service';
import { NotificationService } from './notification.service';
import { BinanceApiService } from './binance-api.service';
import { TechnicalIndicators } from '../utils/technical-indicators';
import { RiskCalculator } from '../utils/risk-calculator';

// portfolio.service.ts  

export interface TradingSignal {
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  price: number;
  reason: string;
  timestamp: Date;
  indicators: {
    rsi?: number;
    trend?: string;
    support?: number;
    resistance?: number;
    volume?: number;
  };
}

export interface TradingDecision {
  symbol: string;
  decision: 'LONG' | 'SHORT' | 'NEUTRAL';
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  riskRewardRatio: number;
  confidence: number;
  timeframe: string;
  signals: TradingSignal[];
}

@Injectable({ providedIn: 'root' })
export class TradingDecisionService {
  private analyticsService = inject(AnalyticsService);
  private alertService = inject(AlertService);
  private notificationService = inject(NotificationService);
  private binanceApi = inject(BinanceApiService);

  private readonly RSI_OVERSOLD = 30;
  private readonly RSI_OVERBOUGHT = 70;
  private readonly VOLUME_THRESHOLD = 1.5; // 150% aumento volume

  async generateDecision(symbol: string): Promise<TradingDecision> {
    const analysis = this.analyticsService.getAnalysis(symbol);
    const signals = await this.generateSignals(symbol, analysis);
    
    return this.calculateDecision(symbol, signals, analysis);
  }

  private async generateSignals(symbol: string, analysis?: PriceAnalysis): Promise<TradingSignal[]> {
    const signals: TradingSignal[] = [];
    const currentPrice = analysis?.currentPrice || 0;

    // 1. Segnale RSI
    if (analysis?.rsi) {
      if (analysis.rsi < this.RSI_OVERSOLD) {
        signals.push({
          symbol,
          action: 'BUY',
          confidence: 0.8,
          price: currentPrice,
          reason: 'RSI in ipervenduto',
          timestamp: new Date(),
          indicators: { rsi: analysis.rsi }
        });
      } else if (analysis.rsi > this.RSI_OVERBOUGHT) {
        signals.push({
          symbol,
          action: 'SELL',
          confidence: 0.7,
          price: currentPrice,
          reason: 'RSI in ipercomprato',
          timestamp: new Date(),
          indicators: { rsi: analysis.rsi }
        });
      }
    }

    // 2. Segnale Trend
    if (analysis?.trend) {
      if (analysis.trend === 'bullish') {
        signals.push({
          symbol,
          action: 'BUY',
          confidence: 0.6,
          price: currentPrice,
          reason: 'Trend rialzista confermato',
          timestamp: new Date(),
          indicators: { trend: analysis.trend }
        });
      } else if (analysis.trend === 'bearish') {
        signals.push({
          symbol,
          action: 'SELL',
          confidence: 0.6,
          price: currentPrice,
          reason: 'Trend ribassista confermato',
          timestamp: new Date(),
          indicators: { trend: analysis.trend }
        });
      }
    }

    // 3. Segnale Volume
    if (analysis?.volume24h && analysis.volume24h > this.VOLUME_THRESHOLD) {
      signals.push({
        symbol,
        action: analysis.trend === 'bullish' ? 'BUY' : 'SELL',
        confidence: 0.7,
        price: currentPrice,
        reason: `Volume aumentato del ${(analysis.volume24h * 100).toFixed(0)}%`,
        timestamp: new Date(),
        indicators: { volume: analysis.volume24h }
      });
    }

    return signals;
  }

  private calculateDecision(symbol: string, signals: TradingSignal[], analysis?: PriceAnalysis): TradingDecision {
    const buySignals = signals.filter(s => s.action === 'BUY');
    const sellSignals = signals.filter(s => s.action === 'SELL');
    
    const buyConfidence = buySignals.reduce((sum, s) => sum + s.confidence, 0);
    const sellConfidence = sellSignals.reduce((sum, s) => sum + s.confidence, 0);

    let decision: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
    let confidence = 0;

    if (buyConfidence > sellConfidence && buyConfidence > 1.0) {
      decision = 'LONG';
      confidence = buyConfidence / buySignals.length;
    } else if (sellConfidence > buyConfidence && sellConfidence > 1.0) {
      decision = 'SHORT';
      confidence = sellConfidence / sellSignals.length;
    }

    return {
      symbol,
      decision,
      confidence,
      riskRewardRatio: this.calculateRiskReward(analysis),
      timeframe: '15m-1h',
      signals,
      ...this.calculateEntryPoints(decision, analysis)
    };
  }

  private calculateRiskReward(analysis?: PriceAnalysis): number {
    if (!analysis?.supportLevels?.[0] || !analysis?.resistanceLevels?.[0]) return 1.5;
    
    const risk = analysis.currentPrice - analysis.supportLevels[0];
    const reward = analysis.resistanceLevels[0] - analysis.currentPrice;
    
    return reward > 0 ? reward / risk : 1.5;
  }

  private calculateEntryPoints(decision: string, analysis?: PriceAnalysis) {
    if (!analysis) return {};

    const currentPrice = analysis.currentPrice;
    const volatility = analysis.volatility || 0;

    if (decision === 'LONG') {
      return {
        entryPrice: currentPrice * 0.995, // -0.5% per entry migliore
        stopLoss: analysis.supportLevels[0] || currentPrice * 0.98,
        takeProfit: analysis.resistanceLevels[0] || currentPrice * 1.03
      };
    } else if (decision === 'SHORT') {
      return {
        entryPrice: currentPrice * 1.005, // +0.5% per entry migliore
        stopLoss: analysis.resistanceLevels[0] || currentPrice * 1.02,
        takeProfit: analysis.supportLevels[0] || currentPrice * 0.97
      };
    }

    return {};
  }

  async executeDecision(decision: TradingDecision): Promise<boolean> {
    try {
      // Qui implementeresti l'API call per eseguire l'ordine
      console.log('Esecuzione decisione:', decision);
      
      this.notificationService.addNotification({
        type: 'success',
        title: `📈 Ordine Eseguito: ${decision.symbol}`,
        message: `${decision.decision} - Entry: $${decision.entryPrice}`
      });

      return true;
    } catch (error) {
      console.error('Errore esecuzione ordine:', error);
      return false;
    }
  }

  getDecisionQuality(decision: TradingDecision): string {
    if (decision.confidence > 0.8 && decision.riskRewardRatio > 2) return 'HIGH';
    if (decision.confidence > 0.6 && decision.riskRewardRatio > 1.5) return 'MEDIUM';
    return 'LOW';
  }

 
// In trading-decision.service.ts
async generateTradingSignal(symbol: string, price: number): Promise<TradingSignal> {
  const analysis = this.analyticsService.getAnalysis(symbol);
  const signals = await this.generateSignals(symbol, analysis);
  
  // Calcola il segnale basato sui segnali generati
  const buySignals = signals.filter(s => s.action === 'BUY');
  const sellSignals = signals.filter(s => s.action === 'SELL');
  
  if (buySignals.length > sellSignals.length) {
    return {
      symbol,
      action: 'BUY',
      confidence: buySignals.reduce((sum, s) => sum + s.confidence, 0) / buySignals.length,
      price,
      reason: 'Segnale di acquisto basato su analisi',
      timestamp: new Date(),
      indicators: {}
    };
  } else if (sellSignals.length > buySignals.length) {
    return {
      symbol,
      action: 'SELL',
      confidence: sellSignals.reduce((sum, s) => sum + s.confidence, 0) / sellSignals.length,
      price,
      reason: 'Segnale di vendita basato su analisi',
      timestamp: new Date(),
      indicators: {}
    };
  }
  
  return {
    symbol,
    action: 'HOLD',
    confidence: 0.5,
    price,
    reason: 'Nessun segnale chiaro',
    timestamp: new Date(),
    indicators: {}
  };
}
}