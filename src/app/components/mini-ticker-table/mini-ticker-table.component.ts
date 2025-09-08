import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MiniTicker } from '../../types/binance.types';

@Component({
  selector: 'app-mini-ticker-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mini-ticker-table.component.html',
  styleUrls: ['./mini-ticker-table.component.scss']
})
export class MiniTickerTableComponent implements OnChanges {
  @Input() tickers: MiniTicker[] = [];
  @Input() title: string = 'MiniTicker Data';

  sortedTickers: MiniTicker[] = [];
  sortField: string = 'symbol';
  sortDirection: 'asc' | 'desc' = 'asc';

  ngOnChanges(changes: SimpleChanges) {
    if (changes['tickers']) {
      this.sortTickers(this.sortField, this.sortDirection);
    }
  }

  sortTickers(field: string, direction: 'asc' | 'desc' = 'asc') {
    this.sortField = field;
    this.sortDirection = direction;

    this.sortedTickers = [...this.tickers].sort((a, b) => {
      let valueA: any, valueB: any;

      switch (field) {
        case 'symbol':
          valueA = a.symbol; valueB = b.symbol; break;
        case 'last_price':
          valueA = a.last_price; valueB = b.last_price; break;
        case 'high_price':
          valueA = a.high_price; valueB = b.high_price; break;
        case 'low_price':
          valueA = a.low_price; valueB = b.low_price; break;
        case 'volume':
          valueA = a.volume; valueB = b.volume; break;
        case 'event_time':
          valueA = a.event_time; valueB = b.event_time; break;
        default:
          valueA = a.symbol; valueB = b.symbol;
      }

      if (typeof valueA === 'string') {
        return direction === 'asc'
          ? valueA.localeCompare(valueB)
          : valueB.localeCompare(valueA);
      } else {
        return direction === 'asc'
          ? valueA - valueB
          : valueB - valueA;
      }
    });
  }

  onSort(field: string) {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortDirection = 'asc';
    }
    this.sortTickers(field, this.sortDirection);
  }

  getSortIcon(field: string): string {
    if (this.sortField !== field) return '↕️';
    return this.sortDirection === 'asc' ? '↑' : '↓';
  }

  getPriceChange(ticker: MiniTicker): number {
    const midPrice = (ticker.high_price + ticker.low_price) / 2;
    return ticker.last_price - midPrice;
  }

  getPriceChangePercent(ticker: MiniTicker): number {
    const midPrice = (ticker.high_price + ticker.low_price) / 2;
    return midPrice !== 0 ? ((ticker.last_price - midPrice) / midPrice) * 100 : 0;
  }
}
