import { Injectable, signal, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

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

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.loadAlerts();
  }

  // Crea un nuovo alert
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

  // Rimuovi un alert
  removeAlert(id: string): void {
    this.alerts.set(this.alerts().filter(alert => alert.id !== id));
    this.saveAlerts();
  }

  // Aggiorna un alert
  updateAlert(id: string, updates: Partial<PriceAlert>): void {
    this.alerts.set(this.alerts().map(alert => 
      alert.id === id ? { ...alert, ...updates } : alert
    ));
    this.saveAlerts();
  }

  // Controlla tutti gli alert per un simbolo e prezzo
  checkAlerts(symbol: string, currentPrice: number): PriceAlert[] {
    const triggeredAlerts: PriceAlert[] = [];
    
    this.alerts().forEach(alert => {
      if (alert.active && !alert.triggered && alert.symbol === symbol.toUpperCase()) {
        const shouldTrigger = alert.condition === 'above' 
          ? currentPrice >= alert.price 
          : currentPrice <= alert.price;
        
        if (shouldTrigger) {
          this.triggerAlert(alert.id);
          triggeredAlerts.push({...alert, triggered: true});
        }
      }
    });
    
    return triggeredAlerts;
  }

  // Attiva un alert
  private triggerAlert(id: string): void {
    this.alerts.set(this.alerts().map(alert => 
      alert.id === id ? { ...alert, triggered: true } : alert
    ));
    this.saveAlerts();
  }

  // Getter per gli alert
  getAlerts() {
    return this.alerts.asReadonly();
  }

  // Salva gli alert nel localStorage (solo browser)
  private saveAlerts(): void {
    if (this.isBrowser) {
      try {
        localStorage.setItem('priceAlerts', JSON.stringify(this.alerts()));
      } catch (error) {
        console.error('Error saving alerts to localStorage:', error);
      }
    }
  }

  // Carica gli alert dal localStorage (solo browser)
  private loadAlerts(): void {
    if (this.isBrowser) {
      try {
        const saved = localStorage.getItem('priceAlerts');
        if (saved) {
          const alerts = JSON.parse(saved);
          // Converti le stringhe date in oggetti Date
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

  // Genera ID unico
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}