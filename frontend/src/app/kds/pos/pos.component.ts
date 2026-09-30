import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { KdsService } from '../kds.service';
import type { ChannelType, OrderPriority } from '../../interfaces/order.interface';
import { environment } from '../../../environments/environment';

interface ItemFormulario {
  productName: string;
  quantity: number;
  notes?: string;
}

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './pos.component.html',
  styleUrl: './pos.component.css',
})
export class PosComponent {
  readonly tenant = environment.displayName;

  readonly displayCode = signal('');
  readonly channel = signal<ChannelType>('DINE_IN');
  readonly priority = signal<OrderPriority>('NORMAL');
  readonly customerName = signal('');
  readonly notes = signal('');
  readonly items = signal<ItemFormulario[]>([]);

  readonly itemName = signal('');
  readonly itemQuantity = signal(1);
  readonly itemNotes = signal('');

  readonly enviando = signal(false);
  readonly mensaje = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  constructor(private kds: KdsService) {}

  agregarItem(): void {
    const nombre = this.itemName().trim();
    if (!nombre || this.itemQuantity() < 1) {
      return;
    }
    this.items.update((lista) => [
      ...lista,
      { productName: nombre, quantity: this.itemQuantity(), notes: this.itemNotes().trim() || undefined },
    ]);
    this.itemName.set('');
    this.itemQuantity.set(1);
    this.itemNotes.set('');
  }

  quitarItem(indice: number): void {
    this.items.update((lista) => lista.filter((_, i) => i !== indice));
  }

  enviar(): void {
    if (this.items().length === 0) {
      this.error.set('Agrega al menos un producto');
      return;
    }
    this.enviando.set(true);
    this.mensaje.set(null);
    this.error.set(null);

    this.kds
      .createOrder({
        displayCode: this.displayCode().trim() || this.codigoAleatorio(),
        channel: this.channel(),
        priority: this.priority(),
        customerName: this.customerName().trim() || null,
        notes: this.notes().trim() || null,
        items: this.items().map((item) => ({
          productName: item.productName,
          quantity: item.quantity,
          notes: item.notes ?? null,
        })),
      })
      .subscribe({
        next: (pedido) => {
          this.mensaje.set(`Pedido ${pedido.displayCode} creado`);
          this.reiniciarFormulario();
        },
        error: () => {
          this.error.set('No se pudo crear el pedido (¿está el backend corriendo?)');
          this.enviando.set(false);
        },
        complete: () => this.enviando.set(false),
      });
  }

  private codigoAleatorio(): string {
    return `#P-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  }

  private reiniciarFormulario(): void {
    this.displayCode.set('');
    this.customerName.set('');
    this.notes.set('');
    this.items.set([]);
  }
}
