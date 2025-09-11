// alert-manager.component.ts - CORREZIONE
import { Component, inject, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AlertService, PriceAlert } from '../../services/alert.service';
import { Observable, map } from 'rxjs';

@Component({
  selector: 'app-alert-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './alert-manager.component.html',
  styleUrls: ['./alert-manager.component.scss']
})
export class AlertManagerComponent implements OnChanges {
  private alertService = inject(AlertService);
  
  alerts$: Observable<PriceAlert[]> = this.alertService.getAlerts();
  filteredAlerts$: Observable<PriceAlert[]> = this.alerts$;
  
  @Input() filterBySymbol: string = '';
  
  newAlert = {
    symbol: 'BTCUSDT',
    condition: 'above' as 'above' | 'below',
    price: 0
  };

  ngOnChanges(changes: SimpleChanges) {
    if (changes['filterBySymbol']) {
      this.updateFilteredAlerts();
    }
  }

  private updateFilteredAlerts() {
    if (!this.filterBySymbol) {
      this.filteredAlerts$ = this.alerts$;
    } else {
      this.filteredAlerts$ = this.alerts$.pipe(
        map(alerts => alerts.filter(alert => 
          alert.symbol.toLowerCase() === this.filterBySymbol.toLowerCase()
        ))
      );
    }
  }

  createAlert() {
    if (this.newAlert.symbol && this.newAlert.price > 0) {
      this.alertService.createAlert(
        this.newAlert.symbol,
        this.newAlert.condition,
        this.newAlert.price
      );
      
      this.newAlert.price = 0;
    }
  }

  removeAlert(id: string) {
    this.alertService.removeAlert(id);
  }

  toggleAlert(id: string) {
    this.alerts$.pipe(
      map(alerts => alerts.find(a => a.id === id))
    ).subscribe(alert => {
      if (alert) {
        this.alertService.updateAlert(id, { active: !alert.active });
      }
    });
  }
}