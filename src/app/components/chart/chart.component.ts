import { Component, Input, OnChanges, ViewChild, ElementRef, SimpleChanges, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, registerables } from 'chart.js';
import { AlertService } from '../../services/alert.service';
import { PriceAlert } from '../../services/alert.service';

Chart.register(...registerables);

@Component({
  selector: 'app-price-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chart.component.html',
  styleUrls: ['./chart.component.scss']
})
export class PriceChartComponent implements OnChanges, OnDestroy {
  @ViewChild('chartCanvas', { static: true }) chartCanvas!: ElementRef;
  @Input() title: string = 'Price Chart';
  @Input() data: number[] = [];
  @Input() labels: string[] = [];
  @Input() symbol: string = '';

  private chart: Chart | null = null;
  private alertService = inject(AlertService);
  private alertSubscription: any;
  private previousAlerts: PriceAlert[] = [];

  ngOnChanges(changes: SimpleChanges) {
    if (changes['symbol'] && this.chart) {
      this.destroyChart();
      this.createChart();
    } else if (changes['data'] || changes['labels']) {
      this.updateChart();
    }
  }

  ngOnInit() {
    this.alertSubscription = this.alertService.getAlerts().subscribe(() => {
      this.updateAlertLines();
    });
  }

  ngOnDestroy() {
    this.destroyChart();
    if (this.alertSubscription) {
      this.alertSubscription.unsubscribe();
    }
  }

  getCurrentPrice(): number {
    return this.data.length > 0 ? this.data[this.data.length - 1] : 0;
  }

  getPriceChange(): number {
    if (this.data.length < 2) return 0;
    return this.data[this.data.length - 1] - this.data[0];
  }

  getPriceChangePercent(): number {
    if (this.data.length < 2 || this.data[0] === 0) return 0;
    return (this.getPriceChange() / this.data[0]) * 100;
  }

  private destroyChart() {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }

  private updateChart() {
    if (!this.chart) {
      this.createChart();
      return;
    }

    this.chart.data.labels = this.labels;
    this.chart.data.datasets[0].data = this.data;
    this.chart.update('none');
  }

// chart.component.ts - CORREZIONE
private createChart() {
  if (!this.data.length || !this.labels.length || !this.symbol) return;
  
  const ctx = this.chartCanvas.nativeElement.getContext('2d');
  if (!ctx) return;

  const alerts = this.getAlertsForSymbol();
  this.previousAlerts = [...alerts];
  
  this.chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: this.labels,
      datasets: [
        {
          label: this.symbol,
          data: this.data,
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2,
          tension: 0.1,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointBackgroundColor: 'rgb(59, 130, 246)',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: 'rgb(59, 130, 246)'
        },
        ...this.createAlertLines(alerts)
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: 'rgba(255, 255, 255, 0.1)',
          borderWidth: 1,
          callbacks: {
            label: (context) => {
              return `${context.dataset.label}: $${context.parsed.y.toFixed(2)}`;
            }
          }
        }
      },
      scales: {
        x: {
          display: true,
          grid: {
            display: false
          },
          ticks: {
            maxTicksLimit: 6,
            font: {
              size: 10
            }
          }
        },
        y: {
          display: true,
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          },
          ticks: {
            font: {
              size: 10
            },
            callback: (value) => {
              return typeof value === 'number' ? '$' + value.toFixed(2) : value;
            }
          }
        }
      },
      interaction: {
        mode: 'index',
        intersect: false
      },
      // CORREZIONE: animations deve essere un oggetto con le proprietà specifiche
      animations: {
        tension: {
          duration: 0,
          easing: 'linear'
        },
        colors: {
          duration: 0
        },
        numbers: {
          duration: 0
        }
      }
    }
  });
}

  private updateAlertLines() {
    if (!this.chart) return;
    
    const currentAlerts = this.getAlertsForSymbol();
    
    if (this.haveAlertsChanged(currentAlerts)) {
      this.previousAlerts = [...currentAlerts];
      
      const mainDataset = this.chart.data.datasets[0];
      this.chart.data.datasets = [mainDataset];
      
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

  // price-chart.component.ts - AGGIORNAMENTO
private getAlertsForSymbol(): PriceAlert[] {
  // Usa getAlertsSnapshot() invece di getAlerts()()
  const allAlerts = this.alertService.getAlertsSnapshot();
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