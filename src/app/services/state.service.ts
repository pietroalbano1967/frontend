import { Injectable, signal, computed } from '@angular/core';
import { MiniTicker } from '../types/binance.types';
import { PriceAlert } from '../services/alert.service';

export interface AppState {
  tickers: MiniTicker[];
  selectedSymbol: string;
  wsStatus: 'connected' | 'disconnected' | 'connecting';
  sortField: string;
  sortDirection: 'asc' | 'desc';
}

@Injectable({ providedIn: 'root' })
export class StateService {
  private state = signal<AppState>({
    tickers: [],
    selectedSymbol: '',
    wsStatus: 'disconnected',
    sortField: 'symbol',
    sortDirection: 'asc'
  });

  // Selectors
  tickers = computed(() => this.state().tickers);
  selectedSymbol = computed(() => this.state().selectedSymbol);
  wsStatus = computed(() => this.state().wsStatus);
  sortConfig = computed(() => ({
    field: this.state().sortField,
    direction: this.state().sortDirection
  }));

  // Actions
  setTickers(tickers: MiniTicker[]) {
    this.state.update(current => ({ ...current, tickers }));
  }

  updateTicker(updatedTicker: MiniTicker) {
    this.state.update(current => ({
      ...current,
      tickers: current.tickers.map(t => 
        t.symbol === updatedTicker.symbol ? updatedTicker : t
      )
    }));
  }

  setSelectedSymbol(symbol: string) {
    this.state.update(current => ({ ...current, selectedSymbol: symbol }));
  }

  setWsStatus(status: AppState['wsStatus']) {
    this.state.update(current => ({ ...current, wsStatus: status }));
  }

  setSortConfig(field: string, direction: 'asc' | 'desc') {
    this.state.update(current => ({ ...current, sortField: field, sortDirection: direction }));
  }

  // Derived state
  sortedTickers = computed(() => {
    const { tickers, sortField, sortDirection } = this.state();
    return [...tickers].sort((a, b) => {
      const valueA = a[sortField as keyof MiniTicker];
      const valueB = b[sortField as keyof MiniTicker];
      
      if (typeof valueA === 'string') {
        return sortDirection === 'asc' 
          ? valueA.localeCompare(valueB as string)
          : (valueB as string).localeCompare(valueA);
      }
      return sortDirection === 'asc' 
        ? (valueA as number) - (valueB as number)
        : (valueB as number) - (valueA as number);
    });
  });

  selectedTicker = computed(() => {
    const symbol = this.state().selectedSymbol;
    return this.state().tickers.find(t => t.symbol === symbol) || null;
  });
}