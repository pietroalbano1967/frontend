// alert.service.ts - VERSIONE COMPLETA CORRETTA
import { Injectable, Inject, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NotificationService } from './notification.service';

export interface PriceAlert {
  id: string;
  symbol: string;
  condition: 'above' | 'below';
  price: number;
  active: boolean;
  triggered: boolean;
  createdAt: Date;
}

@Injectable({ providedIn: 'root' })
export class AlertService {
  private alerts = signal<PriceAlert[]>([]);
  private isBrowser: boolean;
  private notificationService = inject(NotificationService);

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.loadAlerts();
  }

  createAlert(symbol: string, condition: 'above' | 'below', price: number): PriceAlert {
    const newAlert: PriceAlert = {
      id: this.generateId(),
      symbol: symbol.toUpperCase(),
      condition,
      price,
      active: true,
      triggered: false,
      createdAt: new Date()
    };
    
    this.alerts.set([...this.alerts(), newAlert]);
    this.saveAlerts();
    
    return newAlert;
  }

  removeAlert(id: string): void {
    this.alerts.set(this.alerts().filter(alert => alert.id !== id));
    this.saveAlerts();
  }

  updateAlert(id: string, updates: Partial<PriceAlert>): void {
    this.alerts.set(this.alerts().map(alert => 
      alert.id === id ? { ...alert, ...updates } : alert
    ));
    this.saveAlerts();
  }

  checkAlerts(symbol: string, currentPrice: number): PriceAlert[] {
  console.log('Checking alerts for:', symbol, 'price:', currentPrice);
  console.log('Current alerts:', this.alerts());
  const triggeredAlerts: PriceAlert[] = [];
  const upperSymbol = symbol.toUpperCase();
  
  // Prima identifica quali alert devono essere triggerati
  const alertsToTrigger = this.alerts().filter(alert => 
    alert.active && 
    !alert.triggered && 
    alert.symbol === upperSymbol &&
    ((alert.condition === 'above' && currentPrice >= alert.price) ||
     (alert.condition === 'below' && currentPrice <= alert.price))
  );
  
  // Poi triggera ciascun alert e aggiungilo alla lista
  alertsToTrigger.forEach(alert => {
    this.triggerAlert(alert.id);
    // Dopo il trigger, l'alert sarà aggiornato nello stato
    const updatedAlert = this.alerts().find(a => a.id === alert.id);
    if (updatedAlert) {
      triggeredAlerts.push(updatedAlert);
    }
  });
  
  return triggeredAlerts;
}

private triggerAlert(id: string): void {
  this.alerts.set(this.alerts().map(alert => 
    alert.id === id ? { ...alert, triggered: true, active: false } : alert
  ));
  this.saveAlerts();
  
  const alert = this.alerts().find(a => a.id === id);
  if (alert && this.isBrowser) {
    this.notificationService.addNotification({
      type: 'alert',
      title: `Alert Attivato: ${alert.symbol}`,
      message: `${alert.symbol} ha ${alert.condition === 'above' ? 'superato' : 'raggiunto'} $${alert.price}`,
      symbol: alert.symbol,
      price: alert.price
    });
  }
}

  getAlerts() {
    return this.alerts.asReadonly();
  }

  private saveAlerts(): void {
    if (this.isBrowser) {
      try {
        localStorage.setItem('priceAlerts', JSON.stringify(this.alerts()));
      } catch (error) {
        console.error('Error saving alerts to localStorage:', error);
      }
    }
  }

  private loadAlerts(): void {
    if (this.isBrowser) {
      try {
        const saved = localStorage.getItem('priceAlerts');
        if (saved) {
          const alerts = JSON.parse(saved);
          const parsedAlerts = alerts.map((alert: any) => ({
            ...alert,
            createdAt: new Date(alert.createdAt)
          }));
          this.alerts.set(parsedAlerts);
        }
      } catch (error) {
        console.error('Error loading alerts from localStorage:', error);
      }
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}