import { environment } from '@env/environment';
import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthService } from './auth';

export interface AppNotification {
  titulo: string;
  mensaje: string;
  tipo: 'info' | 'success' | 'warning' | 'error';
  fecha: Date;
  enlace?: string;
  leida: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private socket: Socket;
  private serverUrl = environment.wsUrl;
  
  private notificaciones: AppNotification[] = [];
  private notificacionesSubject = new BehaviorSubject<AppNotification[]>([]);

  constructor(private authService: AuthService) {
    this.socket = io(this.serverUrl);

    // Identificarse para recibir notificaciones globales
    const userId = this.authService.getIdUsuario();
    if (userId) {
      this.socket.emit('identificarse', userId);
    }

    // Escuchar notificaciones entrantes
    this.socket.on('nueva-notificacion', (data: any) => {
      const nuevaNotif: AppNotification = {
        ...data,
        leida: false,
        fecha: new Date(data.fecha)
      };
      this.notificaciones.unshift(nuevaNotif); // Añadir al principio
      this.notificacionesSubject.next([...this.notificaciones]);
    });
  }

  getNotificaciones(): Observable<AppNotification[]> {
    return this.notificacionesSubject.asObservable();
  }

  marcarComoLeidas(): void {
    this.notificaciones = this.notificaciones.map(n => ({ ...n, leida: true }));
    this.notificacionesSubject.next([...this.notificaciones]);
  }

  getNoLeidasCount(): number {
    return this.notificaciones.filter(n => !n.leida).length;
  }

  // --- Emisores desde el Profesor ---
  emitirClaseIniciada(cursoId: string, nombreCurso: string, profesorNombre: string): void {
    this.socket.emit('clase-iniciada', { cursoId, nombreCurso, profesorNombre });
  }

  emitirMaterialAgregado(cursoId: string, nombreCurso: string, tituloMaterial: string, profesorNombre: string): void {
    this.socket.emit('material-agregado', { cursoId, nombreCurso, tituloMaterial, profesorNombre });
  }

  desconectar(): void {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}
