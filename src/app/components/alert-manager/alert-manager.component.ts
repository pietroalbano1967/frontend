import { Component, inject } from '@angular/core';
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
  
  newAlert = {
    symbol: 'BTCUSDT',
    condition: 'above' as 'above' | 'below',
    price: 0
  };

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