// components/portfolio/portfolio.component.ts
import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PortfolioService, Portfolio } from '../../services/portfolio.service';
import { TradingSimulatorService } from '../../services/trading-simulator.service';
import { Trade, Position } from '../../types/binance.types';

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './portfolio.component.html',
  styleUrls: ['./portfolio.component.scss']
})
export class PortfolioComponent implements OnInit {
  private portfolioService = inject(PortfolioService);
  private simulator = inject(TradingSimulatorService);

  portfolio = signal<Portfolio>({ cash: 0, equity: 0, totalValue: 0 });
  currentPositions = signal<Position[]>([]);
  tradeHistory = signal<Trade[]>([]);

  ngOnInit(): void {
    this.loadPortfolioData();
  }

  loadPortfolioData(): void {
    this.portfolio.set(this.portfolioService.getPortfolio());
    this.currentPositions.set(this.portfolioService.currentPositions());
    this.tradeHistory.set(this.portfolioService.getTradeHistory());
  }

  async closePosition(position: Position): Promise<void> {
    try {
      const result = await this.simulator.closePositionWithSimulator(
        position.symbol, 
        position.currentPrice
      );
      
      // ✅ Ora 'result' è boolean, non void
      if (result) {
        this.portfolioService.closePosition(position.symbol, position.currentPrice);
        this.loadPortfolioData();
      } else {
        console.warn('Failed to close position in simulator');
      }
    } catch (error) {
      console.error('Error closing position:', error);
    }
  }
}