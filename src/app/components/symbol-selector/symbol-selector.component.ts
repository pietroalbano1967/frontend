import { Component, Output, EventEmitter, OnInit } from '@angular/core';
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
export class SymbolSelectorComponent implements OnInit {
  @Output() symbolsChange = new EventEmitter<string>();
  @Output() clearAll = new EventEmitter<void>();

  searchQuery = '';
  selectedSymbols: string[] = [];
  searchResults: string[] = [];
  popularSymbols: string[] = [];
  showDropdown = false;

  constructor(private api: BinanceApiService) {}

  ngOnInit() {
    this.popularSymbols = this.api.getPopularSymbols();
  }

  onSearchChange(query: string) {
    this.searchQuery = query;
    if (query.length > 1) {
      this.searchResults = this.api.searchSymbols(query);
      this.showDropdown = true;
    } else {
      this.searchResults = [];
      this.showDropdown = false;
    }
  }

  onSearchBlur() {
    // Chiudi il dropdown dopo un piccolo delay per permettere il click sugli items
    setTimeout(() => {
      this.showDropdown = false;
    }, 200);
  }

  selectSymbol(symbol: string) {
    if (!this.selectedSymbols.includes(symbol)) {
      this.selectedSymbols.push(symbol);
      this.updateSymbolsOutput();
    }
    this.searchQuery = '';
    this.showDropdown = false;
  }

  removeSymbol(symbol: string) {
    this.selectedSymbols = this.selectedSymbols.filter(s => s !== symbol);
    this.updateSymbolsOutput();
  }

  togglePopularSymbol(symbol: string) {
    if (this.selectedSymbols.includes(symbol)) {
      this.removeSymbol(symbol);
    } else {
      this.selectSymbol(symbol);
    }
  }

  selectPopularSymbols() {
    this.selectedSymbols = [...this.popularSymbols.slice(0, 5)];
    this.updateSymbolsOutput();
  }

  selectAllMajor() {
    this.selectedSymbols = [...this.popularSymbols.slice(0, 10)];
    this.updateSymbolsOutput();
  }

  clearSymbols() {
    this.selectedSymbols = [];
    this.searchQuery = '';
    this.showDropdown = false;
    this.updateSymbolsOutput();
    this.clearAll.emit();
  }

  applySymbols() {
    // Questo metodo è per forzare l'applicazione dei simboli selezionati
    this.updateSymbolsOutput();
  }

  private updateSymbolsOutput() {
    this.symbolsChange.emit(this.selectedSymbols.join(','));
  }
}