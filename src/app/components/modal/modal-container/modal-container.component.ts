// src/app/components/modal/modal-container/modal-container.component.ts
import { Component, Output, EventEmitter, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-modal-container',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './modal-container.component.html',
  styleUrls: ['./modal-container.component.scss']
})
export class ModalContainerComponent {
  @Input() title: string = '';
  @Input() size: 'sm' | 'md' | 'lg' | 'xl' = 'md';
  @Output() closed = new EventEmitter<void>();

  close() {
    this.closed.emit();
  }
}