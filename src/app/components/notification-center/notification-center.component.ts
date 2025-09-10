// notification-center.component.ts - CORRETTO
import { Component, inject, HostListener, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService, Notification } from '../../services/notification.service';

@Component({
  selector: 'app-notification-center',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-center.component.html',
  styleUrls: ['./notification-center.component.scss']
})
export class NotificationCenterComponent {
  private notificationService = inject(NotificationService);
  
  notifications = this.notificationService.getNotifications();
  isOpen = false;
  unreadCount = computed(() => this.notificationService.getUnreadCount());

  togglePanel(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.markAllAsRead();
    }
  }

  markAsRead(id: string): void {
    this.notificationService.markAsRead(id);
  }

  markAllAsRead(): void {
    this.notificationService.markAllAsRead();
  }

  removeNotification(id: string): void {
    this.notificationService.removeNotification(id);
  }

  clearAll(): void {
    this.notificationService.clearAll();
  }

  getNotificationIcon(type: string): string {
    switch (type) {
      case 'alert': return '⚠️';
      case 'warning': return '⚠️';
      case 'success': return '✅';
      case 'info': return 'ℹ️';
      default: return '📢';
    }
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.notification-center') && this.isOpen) {
      this.isOpen = false;
    }
  }
}