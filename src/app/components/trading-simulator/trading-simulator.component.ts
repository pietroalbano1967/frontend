// components/trading-simulator/trading-simulator.component.ts
import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TradingSimulatorService, SimulationConfig } from '../../services/trading-simulator.service';
import { PortfolioService } from '../../services/portfolio.service';
import { TradingDecisionService } from '../../services/trading-decision.service';

@Component({
  selector: 'app-trading-simulator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './trading-simulator.component.html',
  styleUrls: ['./trading-simulator.component.scss']
})
export class TradingSimulatorComponent implements OnInit {
  private simulator = inject(TradingSimulatorService);
  private portfolioService = inject(PortfolioService);
  private tradingService = inject(TradingDecisionService);

  simulationActive = false;
  config: SimulationConfig = this.simulator.getConfig();
  simulationResults: any = null;
  isLoading = false;

  ngOnInit() {
    this.simulator.isSimulationActive().subscribe(active => {
      this.simulationActive = active;
    });
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

  runBacktest() {
    this.isLoading = true;
    // Qui implementeresti il backtest con dati reali
    setTimeout(() => {
      this.simulationResults = {
        totalProfit: 1250,
        totalTrades: 15,
        winningTrades: 9,
        losingTrades: 6,
        winRate: 60,
        maxDrawdown: 350,
        sharpeRatio: 1.8
      };
      this.isLoading = false;
    }, 3000);
  }

  exportResults() {
    const data = this.portfolioService.exportPortfolioData();
    // If exportPortfolioData does not return data, remove the check and handle export inside the service or here as needed
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'trading-simulation-results.json';
    a.click();
    window.URL.revokeObjectURL(url);
  }
}