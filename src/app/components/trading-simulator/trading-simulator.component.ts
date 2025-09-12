// components/trading-simulator/trading-simulator.component.ts
import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TradingSimulatorService, SimulationConfig, TradingSignal, MarketData } from '../../services/trading-simulator.service';
import { PortfolioService } from '../../services/portfolio.service';
import { TradingDecisionService } from '../../services/trading-decision.service';
import { Subscription } from 'rxjs';
import { CurrencyPipe, PercentPipe } from '@angular/common';
@Component({
  selector: 'app-trading-simulator',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyPipe, PercentPipe],
  templateUrl: './trading-simulator.component.html',
  styleUrls: ['./trading-simulator.component.scss']
})
export class TradingSimulatorComponent implements OnInit, OnDestroy {
   
  public portfolioService = inject(PortfolioService);
  public simulator = inject(TradingSimulatorService);
  private tradingService = inject(TradingDecisionService);
  
  // SOSTITUISCI 'subscriptions' CON 'dataSubscription' E AGGIUNGI LE ALTRE
  private simulationSubscription!: Subscription;
  private signalsSubscription!: Subscription;
  private marketDataSubscription!: Subscription;
  private portfolioSubscription!: Subscription;

  simulationActive = false;
  config: SimulationConfig = this.simulator.getConfig();
  simulationResults: any = null;
  isLoading = false;
  selectedSymbol: string = 'BTCUSDT';
  tradingSignals: TradingSignal[] = [];
  marketData: MarketData[] = [];
  portfolio: any = {};
  currentPositions: any[] = [];

  ngOnInit() {
    // Sottoscrizione allo stato della simulazione
    this.simulationSubscription = this.simulator.isSimulationActive().subscribe(active => {
      this.simulationActive = active;
      console.log('Simulation active:', active);
    });

    // Sottoscrizione ai segnali di trading
    this.signalsSubscription = this.simulator.getTradingSignals().subscribe(signals => {
      this.tradingSignals = signals;
      console.log('New trading signals:', signals);
    });

    // Sottoscrizione ai dati di mercato
    this.marketDataSubscription = this.simulator.getMarketData().subscribe(data => {
      this.marketData = data;
      console.log('Market data updated:', data);
    });

    // Inizializza il portfolio e le posizioni
    this.updatePortfolioData();

    // Sottoscrizione agli aggiornamenti del portfolio
    this.portfolioSubscription = this.portfolioService.getPortfolioUpdated().subscribe(() => {
      this.updatePortfolioData();
    });
  }

  ngOnDestroy() {
    // Cancella tutte le sottoscrizioni
    if (this.simulationSubscription) this.simulationSubscription.unsubscribe();
    if (this.signalsSubscription) this.signalsSubscription.unsubscribe();
    if (this.marketDataSubscription) this.marketDataSubscription.unsubscribe();
    if (this.portfolioSubscription) this.portfolioSubscription.unsubscribe();
  }

  private updatePortfolioData() {
    this.portfolio = this.portfolioService.getPortfolio();
    this.currentPositions = this.portfolioService.currentPositions();
  }

  toggleSimulation() {
    if (this.simulationActive) {
      this.simulator.stopRealTimeSimulation();
    } else {
      this.simulator.startRealTimeSimulation();
    }
  }

  updateConfig() {
    this.simulator.updateConfig(this.config);
  }

  

  resetPortfolio() {
    this.portfolioService.resetPortfolio();
  }

  async runBacktest() {
    this.isLoading = true;
    
    try {
      const results = await this.simulator.runHistoricalBacktest(
        this.selectedSymbol,
        30,
        (data: any) => {
          // Implementa la tua strategia di trading qui
          const currentClose = data.close;
          const currentVolume = data.volume;
          const prevClose = data.prevClose || data.open;
          
          // Calcola indicatori semplici
          const priceChange = ((currentClose - prevClose) / prevClose) * 100;
          const isBullish = currentClose > data.open;
          const isHighVolume = currentVolume > (data.avgVolume || currentVolume * 1.2);

          // Logica di trading
          if (isBullish && priceChange > 1 && isHighVolume) {
            return {
              symbol: data.symbol || this.selectedSymbol,
              decision: 'LONG',
              entryPrice: currentClose,
              confidence: 0.7,
              riskRewardRatio: 2,
              timeframe: '1d',
              signals: ['bullish_trend', 'high_volume', 'strong_move']
            } as any;
          } else if (!isBullish && priceChange < -1 && isHighVolume) {
            return {
              symbol: data.symbol || this.selectedSymbol,
              decision: 'SHORT',
              entryPrice: currentClose,
              confidence: 0.6,
              riskRewardRatio: 2,
              timeframe: '1d',
              signals: ['bearish_trend', 'high_volume', 'strong_move']
            } as any;
          } else {
            return {
              symbol: data.symbol || this.selectedSymbol,
              decision: 'NEUTRAL',
              entryPrice: currentClose,
              confidence: 0.3,
              riskRewardRatio: 2,
              timeframe: '1d',
              signals: ['no_clear_signal']
            } as any;
          }
        }
      );

      this.simulationResults = results;
    } catch (error) {
      console.error('Errore nel backtest:', error);
    } finally {
      this.isLoading = false;
    }
  }

  runRealBacktest() {
    this.isLoading = true;
    
    this.simulator.runRealBacktest(this.selectedSymbol, 30).then(results => {
      this.simulationResults = results;
      this.isLoading = false;
    }).catch(error => {
      console.error('Errore nel backtest reale:', error);
      this.isLoading = false;
    });
  }

  exportResults() {
    const data = this.portfolioService.exportPortfolioData();
    const jsonData = typeof data === 'string' ? data : JSON.stringify(data ?? {});
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'trading-simulation-results.json';
    a.click();
    window.URL.revokeObjectURL(url);
  }
}