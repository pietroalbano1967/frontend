// src/app/components/modal/alerts-modal/alerts-modal.component.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalContainerComponent } from '../modal-container/modal-container.component';
import { AlertManagerComponent } from '../../alert-manager/alert-manager.component';

@Component({
  selector: 'app-alerts-modal',
  standalone: true,
  imports: [CommonModule, ModalContainerComponent, AlertManagerComponent],
  templateUrl: './alerts-modal.component.html',
  styleUrls: ['./alerts-modal.component.scss']
})
export class AlertsModalComponent {
  selectedSymbol: string = '';

  onClose() {
    // Logica per chiudere la modale
  }
}