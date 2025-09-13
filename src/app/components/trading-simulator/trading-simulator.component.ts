import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Observable } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
import { WebSocketMessage } from '../../types/binance.types';
import { TradingSimulatorService } from '../../services/trading-simulator.service';
import { PortfolioService, Portfolio } from '../../services/portfolio.service';
import { TradingDecisionService, TradingSignal } from '../../services/trading-decision.service';

@Component({
  selector: 'app-trading-simulator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './trading-simulator.component.html',
  styleUrls: ['./trading-simulator.component.scss']
})
export class TradingSimulatorComponent implements OnInit, OnDestroy {
  // Proprietà del componente
  simulationActive = false;
  isLoading = false;
  selectedSymbol = 'BTCUSDT';
  marketData: any[] = [];
  tradingSignals: TradingSignal[] = [];
  currentPositions: any[] = [];
  
  // Configurazione
  config = {
    initialCapital: 10000,
    commission: 0.001,
    riskPerTrade: 0.02,
    slippage: 0.001,
    maxPositions: 5,
    stopLossPercent: 0.02,
    takeProfitPercent: 0.04
  };

  // Risultati della simulazione
  simulationResults: any = null;
  
  // Portfolio
  portfolio: Portfolio = {
    cash: 0,
    equity: 0,
    totalValue: 0
  };

  constructor(
    private simulator: TradingSimulatorService,
    private portfolioService: PortfolioService,
    private decisionService: TradingDecisionService
  ) {}

  ngOnInit(): void {
    this.initializePortfolio();
    this.loadInitialData();
  }

  ngOnDestroy(): void {
    this.stopSimulation();
  }

  initializePortfolio(): void {
    this.portfolioService.initializePortfolio(this.config.initialCapital);
    this.updatePortfolioData();
  }

  updatePortfolioData(): void {
    this.portfolio = this.portfolioService.getPortfolio();
    this.currentPositions = this.portfolioService.currentPositions();
  }

  loadInitialData(): void {
    // Carica dati iniziali se necessario
  }

  toggleSimulation(): void {
    if (this.simulationActive) {
      this.stopSimulation();
    } else {
      this.startSimulation();
    }
  }

  startSimulation(): void {
    this.simulationActive = true;
    this.simulator.startSimulation();
    console.log('Simulation started');
  }

  stopSimulation(): void {
    this.simulationActive = false;
    this.simulator.stopSimulation();
    console.log('Simulation stopped');
  }

  updateConfig(): void {
    // Aggiorna la configurazione
    this.portfolioService.initializePortfolio(this.config.initialCapital);
    console.log('Configuration updated', this.config);
  }

  runBacktest(): void {
    this.isLoading = true;
    console.log('Running backtest...');
    
    // Simula un backtest
    setTimeout(() => {
      this.simulationResults = {
        totalProfit: 1250.50,
        totalTrades: 42,
        winRate: 0.65,
        sharpeRatio: 1.8,
        maxDrawdown: -350.75
      };
      this.isLoading = false;
    }, 2000);
  }

  resetPortfolio(): void {
    this.portfolioService.resetPortfolio();
    this.updatePortfolioData();
    this.simulationResults = null;
    console.log('Portfolio reset');
  }

  exportResults(): void {
    console.log('Exporting results...');
    // Implementa l'esportazione dei risultati
  }

  // Metodo per processare nuovi dati di mercato
  onMarketData(data: any): void {
    this.marketData = [data, ...this.marketData.slice(0, 9)]; // Mantieni solo gli ultimi 10
    this.processTradingDecision(data);
  }

  private processTradingDecision(data: any): void {
    // Simula la generazione di segnali di trading
    const signal: TradingSignal = {
      symbol: data.symbol,
      action: Math.random() > 0.5 ? 'BUY' : 'SELL',
      confidence: Math.random() * 0.5 + 0.5, // 0.5 - 1.0
      price: data.price,
      reason: 'Simulated trading signal',
      timestamp: new Date(),
      indicators: {}
    };

    this.tradingSignals = [signal, ...this.tradingSignals.slice(0, 9)]; // Mantieni solo gli ultimi 10
  }
}