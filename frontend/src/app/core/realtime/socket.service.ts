import { Injectable, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';

@Injectable({ providedIn: 'root' })
export class SocketService {
  private socket: Socket | null = null;
  readonly connected = signal(false);

  constructor(private auth: AuthService) {}

  connect(): void {
    if (this.socket) {
      return;
    }
    this.socket = io(environment.apiUrl, {
      auth: (cb) => cb({ token: this.auth.token() }), // se evalúa en cada (re)conexión: toma el token ya refrescado
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
    });
    this.socket.on('connect', () => this.connected.set(true));
    this.socket.on('disconnect', () => this.connected.set(false));
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.connected.set(false);
  }

  on<T>(event: string): Observable<T> {
    return new Observable((subscriber) => {
      const socket = this.socket;
      if (!socket) {
        return;
      }
      const handler = (data: T) => subscriber.next(data);
      socket.on(event, handler);
      return () => socket.off(event, handler);
    });
  }
}
