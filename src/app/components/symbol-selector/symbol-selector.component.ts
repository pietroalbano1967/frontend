import { Component, inject, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BinanceApiService } from '../../services/binance-api.service';

@Component({
  selector: 'app-symbol-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './symbol-selector.component.html',
  styleUrls: ['./symbol-selector.component.scss']
})
export class SymbolSelectorComponent {
  private api = inject(BinanceApiService);
  
  @Output() symbolsChange = new EventEmitter<string>();
  
  popularSymbols = this.api.getPopularSymbols();
  searchQuery = '';
  searchResults: string[] = [];
  selectedSymbols: string[] = ['btcusdt', 'ethusdt'];
  showDropdown = false;

  onSearchChange(query: string) {
    this.searchQuery = query;
    const trimmedQuery = query.trim();
    
    if (trimmedQuery.length > 1) {
      this.searchResults = this.api.searchSymbols(trimmedQuery);
      this.showDropdown = true;
    } else {
      this.searchResults = [];
      this.showDropdown = false;
    }
  }

  selectSymbol(symbol: string) {
    const trimmedSymbol = symbol.trim();
    if (trimmedSymbol && !this.selectedSymbols.includes(trimmedSymbol)) {
      this.selectedSymbols.push(trimmedSymbol);
      this.emitSymbols();
    }
    this.searchQuery = '';
    this.showDropdown = false;
  }

  removeSymbol(symbol: string) {
    this.selectedSymbols = this.selectedSymbols.filter(s => s !== symbol);
    this.emitSymbols();
  }

  selectPopularSymbols() {
    this.selectedSymbols = ['btcusdt', 'ethusdt', 'bnbusdt', 'solusdt'];
    this.emitSymbols();
  }

  selectAllMajor() {
    this.selectedSymbols = this.popularSymbols.slice(0, 10);
    this.emitSymbols();
  }

  clearSymbols() {
    this.selectedSymbols = [];
    this.emitSymbols();
  }

  private emitSymbols() {
    // Filtra i simboli vuoti e trimma gli spazi
    const validSymbols = this.selectedSymbols
      .filter(symbol => symbol.trim().length > 0)
      .map(symbol => symbol.trim());
    
    this.symbolsChange.emit(validSymbols.join(','));
  }
}