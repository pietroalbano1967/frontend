import { Component, Input, OnChanges, ViewChild, ElementRef, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, registerables } from 'chart.js';
import { AlertService } from '../../services/alert.service';
import { PriceAlert } from '../../services/alert.service';

Chart.register(...registerables);

@Component({
  selector: 'app-price-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="chart-container">
      <h3>{{ title }}</h3>
      <canvas #chartCanvas></canvas>
    </div>
  `,
  styles: [`
    .chart-container {
      background: white;
      padding: 20px;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      margin-bottom: 20px;
    }
    canvas {
      width: 100% !important;
      height: 300px !important;
    }
  `]
})
export class PriceChartComponent implements OnChanges {
  @ViewChild('chartCanvas', { static: true }) chartCanvas!: ElementRef;
  @Input() title: string = 'Price Chart';
  @Input() data: number[] = [];
  @Input() labels: string[] = [];
  @Input() symbol: string = '';

  private chart: Chart | null = null;
  private alertService = inject(AlertService);
  private previousAlerts: PriceAlert[] = [];
  private previousSymbol: string = '';

  ngOnChanges(changes: SimpleChanges) {
    if (changes['data'] || changes['labels']) {
      this.updateChart();
    }
    
    if (changes['symbol']) {
      // Se cambia il simbolo, ricrea completamente il grafico
      if (this.chart && this.previousSymbol !== this.symbol) {
        this.chart.destroy();
        this.chart = null;
        this.previousSymbol = this.symbol;
      }
      if (this.data.length > 0 && this.labels.length > 0 && this.symbol) {
        this.createChart();
      }
    }
  }

  private updateChart() {
    if (!this.chart) {
      this.createChart();
      return;
    }

    // Aggiorna solo i dati invece di ricreare il grafico
    this.chart.data.labels = this.labels;
    this.chart.data.datasets[0].data = this.data;
    this.chart.data.datasets[0].label = this.symbol;
    
    // Aggiorna le linee degli alert se sono cambiate
    this.updateAlertLines();
    
    this.chart.update('none'); // 'none' per evitare animazioni
  }

  private createChart() {
    if (!this.data.length || !this.labels.length || !this.symbol) return;
    
    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    
    // Ottieni gli alert per questo simbolo
    const alerts = this.getAlertsForSymbol();
    this.previousAlerts = [...alerts];
    this.previousSymbol = this.symbol;
    
    const alertLines = this.createAlertLines(alerts);
    
    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: this.labels,
        datasets: [
          {
            label: this.symbol,
            data: this.data,
            borderColor: 'rgb(75, 192, 192)',
            tension: 0.1,
            fill: false,
            pointBackgroundColor: 'rgb(75, 192, 192)',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: 'rgb(75, 192, 192)'
          },
          ...alertLines
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
          },
          tooltip: {
            mode: 'index',
            intersect: false,
          }
        },
        scales: {
          x: {
            display: true,
            title: {
              display: true,
              text: 'Time'
            }
          },
          y: {
            display: true,
            title: {
              display: true,
              text: 'Price (USDT)'
            }
          }
        }
      }
    });
  }

  private updateAlertLines() {
    if (!this.chart) return;
    
    const currentAlerts = this.getAlertsForSymbol();
    
    // Controlla se gli alert sono cambiati
    const alertsChanged = this.haveAlertsChanged(currentAlerts);
    
    if (alertsChanged) {
      this.previousAlerts = [...currentAlerts];
      
      // Rimuovi tutti i dataset degli alert (tutti tranne il primo)
      const mainDataset = this.chart.data.datasets[0];
      this.chart.data.datasets = [mainDataset];
      
      // Aggiungi i nuovi dataset degli alert
      const alertLines = this.createAlertLines(currentAlerts);
      this.chart.data.datasets.push(...alertLines);
      
      this.chart.update('none');
    }
  }

  private haveAlertsChanged(currentAlerts: PriceAlert[]): boolean {
    if (this.previousAlerts.length !== currentAlerts.length) return true;
    
    return this.previousAlerts.some((prevAlert, index) => {
      const currentAlert = currentAlerts[index];
      return !currentAlert || 
             prevAlert.price !== currentAlert.price ||
             prevAlert.condition !== currentAlert.condition ||
             prevAlert.active !== currentAlert.active;
    });
  }

  private getAlertsForSymbol(): PriceAlert[] {
    const allAlerts = this.alertService.getAlerts()();
    return allAlerts.filter((alert: PriceAlert) => 
      alert.symbol.toLowerCase() === this.symbol.toLowerCase() && 
      alert.active && 
      !alert.triggered
    );
  }

  private createAlertLines(alerts: PriceAlert[]): any[] {
    return alerts.map(alert => {
      const lineColor = alert.condition === 'above' ? 'rgba(40, 167, 69, 0.7)' : 'rgba(220, 53, 69, 0.7)';
      const lineStyle = alert.condition === 'above' ? 'dash' : 'dot';
      
      return {
        label: `${alert.condition === 'above' ? '↑' : '↓'} $${alert.price.toFixed(2)}`,
        data: Array(this.data.length).fill(alert.price),
        borderColor: lineColor,
        borderWidth: 2,
        borderDash: lineStyle === 'dash' ? [5, 5] : [2, 2],
        pointRadius: 0,
        fill: false,
        tension: 0,
        pointHoverRadius: 0,
        spanGaps: true
      };
    });
  }
}