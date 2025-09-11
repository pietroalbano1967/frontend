// components/trading-dashboard/trading-dashboard.component.ts
import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TradingDecisionService, TradingDecision, TradingSignal } from '../../services/trading-decision.service';
import { AnalyticsService } from '../../services/analytics.service';

@Component({
  selector: 'app-trading-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './trading-dashboard.component.html',
  styleUrls: ['./trading-dashboard.component.scss']
})
export class TradingDashboardComponent implements OnInit, OnDestroy {
  // RIMUOVI 'private' per renderlo accessibile nel template
  tradingService = inject(TradingDecisionService);
  private analyticsService = inject(AnalyticsService);

  decisions: TradingDecision[] = [];
  isLoading = false;
  private updateInterval: any;

  ngOnInit() {
    this.startAutoAnalysis();
  }

  ngOnDestroy() {
    this.stopAutoAnalysis();
  }

  startAutoAnalysis() {
    this.updateInterval = setInterval(() => {
      this.analyzeSymbols();
    }, 30000); // Ogni 30 secondi
  }

  stopAutoAnalysis() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
  }

  async analyzeSymbols() {
    this.isLoading = true;
    const analyses = this.analyticsService.getAllAnalyses();
    
    this.decisions = [];
    
    for (const analysis of analyses) {
      try {
        const decision = await this.tradingService.generateDecision(analysis.symbol);
        this.decisions.push(decision);
      } catch (error) {
        console.error(`Errore analisi ${analysis.symbol}:`, error);
      }
    }
    
    this.decisions.sort((a, b) => b.confidence - a.confidence);
    this.isLoading = false;
  }

  async executeDecision(decision: TradingDecision) {
    const success = await this.tradingService.executeDecision(decision);
    if (success) {
      this.decisions = this.decisions.filter(d => d.symbol !== decision.symbol);
    }
  }

  getDecisionClass(decision: string): string {
    switch (decision) {
      case 'LONG': return 'decision-long';
      case 'SHORT': return 'decision-short';
      default: return 'decision-neutral';
    }
  }

  getQualityClass(quality: string): string {
    switch (quality) {
      case 'HIGH': return 'quality-high';
      case 'MEDIUM': return 'quality-medium';
      default: return 'quality-low';
    }
  }
  getDecisionQuality(decision: TradingDecision): string {
    return this.tradingService.getDecisionQuality(decision);
  }
}