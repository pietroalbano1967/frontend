// components/portfolio/portfolio.component.ts
import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PortfolioService, Portfolio, Trade, Position } from '../../services/portfolio.service';
import { TradingSimulatorService } from '../../services/trading-simulator.service';

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './portfolio.component.html',
  styleUrls: ['./portfolio.component.scss']
})
export class PortfolioComponent implements OnInit {
  private portfolioService = inject(PortfolioService);
  private tradingSimulator = inject(TradingSimulatorService);
  
  portfolio = signal<Portfolio>(this.portfolioService.getPortfolio());
  currentPositions = signal<Position[]>(this.portfolioService.currentPositions());
  tradeHistory = signal<Trade[]>(this.portfolioService.getTradeHistory());

  ngOnInit() {
    console.log('Portfolio component initialized');
  }

  async closePosition(position: Position) {
    try {
      const result = await this.tradingSimulator.closePositionWithSimulator(position, position.currentPrice);
      
      if (result.success) {
        this.portfolioService.closePosition(position.symbol, result.closedPrice, result.pnl);
        
        // Aggiorna i dati dopo la chiusura
        this.portfolio.set(this.portfolioService.getPortfolio());
        this.currentPositions.set(this.portfolioService.currentPositions());
        this.tradeHistory.set(this.portfolioService.getTradeHistory());
      }
    } catch (error) {
      console.error('Error closing position:', error);
    }
  }
}