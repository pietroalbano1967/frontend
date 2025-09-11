// alert.service.ts - VERSIONE CORRETTA
import { Injectable, Inject, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NotificationService } from './notification.service';
import { BehaviorSubject } from 'rxjs';

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
  private alertsSubject = new BehaviorSubject<PriceAlert[]>([]);
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
    this.alertsSubject.next(this.alerts()); // Notifica i subscribers
    
    return newAlert;
  }

  removeAlert(id: string): void {
    this.alerts.set(this.alerts().filter(alert => alert.id !== id));
    this.saveAlerts();
    this.alertsSubject.next(this.alerts()); // Notifica i subscribers
  }

  updateAlert(id: string, updates: Partial<PriceAlert>): void {
    this.alerts.set(this.alerts().map(alert => 
      alert.id === id ? { ...alert, ...updates } : alert
    ));
    this.saveAlerts();
    this.alertsSubject.next(this.alerts()); // Notifica i subscribers
  }

  checkAlerts(symbol: string, currentPrice: number): PriceAlert[] {
    console.log('AlertService.checkAlerts called:', symbol, currentPrice);
    
    const triggeredAlerts: PriceAlert[] = [];
    const upperSymbol = symbol.toUpperCase();
    
    // Usa getAlertsSnapshot() per ottenere l'array corrente
    const alertsToTrigger = this.getAlertsSnapshot().filter(alert => 
      alert.active && 
      !alert.triggered && 
      alert.symbol === upperSymbol &&
      ((alert.condition === 'above' && currentPrice >= alert.price) ||
       (alert.condition === 'below' && currentPrice <= alert.price))
    );
    
    console.log('Alerts to trigger:', alertsToTrigger);
    
    alertsToTrigger.forEach(alert => {
      this.triggerAlert(alert.id);
      const updatedAlert = this.getAlertsSnapshot().find(a => a.id === alert.id);
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
    this.alertsSubject.next(this.alerts()); // Notifica i subscribers
    
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
    return this.alertsSubject.asObservable();
  }

  getAlertsSnapshot(): PriceAlert[] {
    return this.alerts();
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
          this.alertsSubject.next(parsedAlerts); // Notifica i subscribers
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