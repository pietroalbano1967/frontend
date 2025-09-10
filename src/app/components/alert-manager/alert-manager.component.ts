import { Component, inject, Input } from '@angular/core'; // Aggiungi Input qui
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
export class AlertManagerComponent {
  private alertService = inject(AlertService);
  
  alerts = this.alertService.getAlerts();
  
  // Aggiungi la proprietà Input per filtrare per simbolo
  @Input() filterBySymbol: string = '';
  
  newAlert = {
    symbol: 'BTCUSDT',
    condition: 'above' as 'above' | 'below',
    price: 0
  };

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