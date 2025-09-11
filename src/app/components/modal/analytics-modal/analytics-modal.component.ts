// src/app/components/modal/analytics-modal/analytics-modal.component.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalContainerComponent } from '../modal-container/modal-container.component';
import { AnalyticsDashboardComponent } from '../../analytics-dashboard/analytics-dashboard.component';

@Component({
  selector: 'app-analytics-modal',
  standalone: true,
  imports: [CommonModule, ModalContainerComponent, AnalyticsDashboardComponent],
  templateUrl: './analytics-modal.component.html',
  styleUrls: ['./analytics-modal.component.scss']
})
export class AnalyticsModalComponent {
  selectedSymbol: string = '';

  onClose() {
    // Logica per chiudere la modale (gestita dal parent)
  }
}