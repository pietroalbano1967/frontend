import { Component, Input, OnChanges, ViewChild, ElementRef, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, registerables } from 'chart.js';

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

  ngOnChanges(changes: SimpleChanges) {
    if (changes['data'] || changes['labels']) {
      this.updateChart();
    }
  }

  private updateChart() {
    if (this.chart) {
      this.chart.destroy();
    }

    if (this.data.length > 0 && this.labels.length > 0) {
      this.createChart();
    }
  }

  private createChart() {
    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    
    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: this.labels,
        datasets: [{
          label: this.symbol,
          data: this.data,
          borderColor: 'rgb(75, 192, 192)',
          tension: 0.1,
          fill: false,
          pointBackgroundColor: 'rgb(75, 192, 192)',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: 'rgb(75, 192, 192)'
        }]
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
}