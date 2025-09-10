// services/notification.service.ts
import { Injectable, Inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface Notification {
  id: string;
  type: 'alert' | 'info' | 'warning' | 'success';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  symbol?: string;
  price?: number;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private notifications = signal<Notification[]>([]);
  private isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
    this.loadNotifications();
  }

  addNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>): void {
    const newNotification: Notification = {
      ...notification,
      id: this.generateId(),
      timestamp: new Date(),
      read: false
    };

    this.notifications.set([newNotification, ...this.notifications()]);
    this.saveNotifications();

    if (this.isBrowser && 'Notification' in window) {
      this.showBrowserNotification(newNotification);
    }
  }

  markAsRead(id: string): void {
    this.notifications.set(
      this.notifications().map(n => 
        n.id === id ? { ...n, read: true } : n
      )
    );
    this.saveNotifications();
  }

  markAllAsRead(): void {
    this.notifications.set(
      this.notifications().map(n => ({ ...n, read: true }))
    );
    this.saveNotifications();
  }

  removeNotification(id: string): void {
    this.notifications.set(this.notifications().filter(n => n.id !== id));
    this.saveNotifications();
  }

  clearAll(): void {
    this.notifications.set([]);
    this.saveNotifications();
  }

  getNotifications() {
    return this.notifications.asReadonly();
  }

// notification.service.ts - CORRETTO
getUnreadCount(): number {
  return this.notifications().filter(n => !n.read).length;
}

  private showBrowserNotification(notification: Notification): void {
    if (Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/assets/notification-icon.png',
        tag: notification.id
      });
    }
  }

  requestNotificationPermission(): Promise<NotificationPermission> {
    if (!this.isBrowser || !('Notification' in window)) {
      return Promise.resolve('denied');
    }

    return Notification.requestPermission();
  }

  private saveNotifications(): void {
    if (this.isBrowser) {
      localStorage.setItem('notifications', JSON.stringify(this.notifications()));
    }
  }

  private loadNotifications(): void {
    if (this.isBrowser) {
      const saved = localStorage.getItem('notifications');
      if (saved) {
        const notifications = JSON.parse(saved);
        const parsedNotifications = notifications.map((n: any) => ({
          ...n,
          timestamp: new Date(n.timestamp)
        }));
        this.notifications.set(parsedNotifications);
      }
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}