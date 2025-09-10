import { Component, inject, Input, OnChanges, SimpleChanges } from '@angular/core'; // Aggiungi OnChanges e SimpleChanges
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AlertService, PriceAlert } from '../../services/alert.service';

@Component({
  selector: 'app-alert-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './alert-manager.component.html',
  styleUrls: ['./alert-manager.component.scss']
})
export class AlertManagerComponent implements OnChanges { // Implementa OnChanges
  private alertService = inject(AlertService);
  
  alerts = this.alertService.getAlerts();
  
  @Input() filterBySymbol: string = '';
  
  newAlert = {
    symbol: 'BTCUSDT',
    condition: 'above' as 'above' | 'below',
    price: 0
  };

  // Aggiungi il metodo ngOnChanges
  ngOnChanges(changes: SimpleChanges) {
    if (changes['filterBySymbol'] && this.filterBySymbol) {
      // Quando c'è un filtro, precompila automaticamente il simbolo
      this.newAlert.symbol = this.filterBySymbol.toUpperCase();
    }
  }

  // Metodo per ottenere gli alert filtrati
  get filteredAlerts() {
    if (!this.filterBySymbol) return this.alerts();
    return this.alerts().filter(alert => 
      alert.symbol.toLowerCase() === this.filterBySymbol.toLowerCase()
    );
  }

  createAlert() {
    if (this.newAlert.symbol && this.newAlert.price > 0) {
      this.alertService.createAlert(
        this.newAlert.symbol,
        this.newAlert.condition,
        this.newAlert.price
      );
      
      // Reset form
      this.newAlert.price = 0;
    }
  }

  removeAlert(id: string) {
    this.alertService.removeAlert(id);
  }

  toggleAlert(id: string) {
    const alert = this.alerts().find(a => a.id === id);
    if (alert) {
      this.alertService.updateAlert(id, { active: !alert.active });
    }
  }
}