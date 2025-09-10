// services/analytics.service.ts
import { Injectable, signal } from '@angular/core';
import { MiniTicker } from '../types/binance.types';

export interface PriceAnalysis {
  symbol: string;
  currentPrice: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  volume24h: number;
  volatility: number;
  supportLevels: number[];
  resistanceLevels: number[];
  trend: 'bullish' | 'bearish' | 'neutral';
  rsi?: number;
  movingAverage?: number;
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private priceHistory = signal<Map<string, number[]>>(new Map());
  private analyses = signal<Map<string, PriceAnalysis>>(new Map());

  updatePrice(symbol: string, price: number): void {
    const history = this.priceHistory().get(symbol) || [];
    const newHistory = [...history, price].slice(-100);
    
    this.priceHistory().set(symbol, newHistory);
    this.priceHistory.set(new Map(this.priceHistory()));
    
    this.analyzePrice(symbol, newHistory);
  }

  private analyzePrice(symbol: string, prices: number[]): void {
    if (prices.length < 2) return;

    const currentPrice = prices[prices.length - 1];
    const previousPrice = prices[prices.length - 2];
    const priceChange = currentPrice - previousPrice;
    const priceChangePercent = (priceChange / previousPrice) * 100;

    const volatility = this.calculateVolatility(prices);
    const supportLevels = this.identifySupportLevels(prices);
    const resistanceLevels = this.identifyResistanceLevels(prices);
    const trend = this.determineTrend(prices);

    const analysis: PriceAnalysis = {
      symbol,
      currentPrice,
      priceChange24h: priceChange,
      priceChangePercent24h: priceChangePercent,
      volume24h: 0,
      volatility,
      supportLevels,
      resistanceLevels,
      trend
    };

    this.analyses().set(symbol, analysis);
    this.analyses.set(new Map(this.analyses()));
  }

  private calculateVolatility(prices: number[]): number {
    const mean = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const squaredDiffs = prices.map(price => Math.pow(price - mean, 2));
    const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / prices.length;
    return Math.sqrt(variance);
  }

  private identifySupportLevels(prices: number[]): number[] {
    const sorted = [...prices].sort((a, b) => a - b);
    return [sorted[0], sorted[Math.floor(sorted.length * 0.25)]];
  }

  private identifyResistanceLevels(prices: number[]): number[] {
    const sorted = [...prices].sort((a, b) => b - a);
    return [sorted[0], sorted[Math.floor(sorted.length * 0.25)]];
  }

  private determineTrend(prices: number[]): 'bullish' | 'bearish' | 'neutral' {
    if (prices.length < 5) return 'neutral';
    
    const recent = prices.slice(-5);
    const first = recent[0];
    const last = recent[recent.length - 1];
    
    if (last > first * 1.02) return 'bullish';
    if (last < first * 0.98) return 'bearish';
    return 'neutral';
  }

  getAnalysis(symbol: string): PriceAnalysis | undefined {
    return this.analyses().get(symbol);
  }

  getAllAnalyses(): PriceAnalysis[] {
    return Array.from(this.analyses().values());
  }
}