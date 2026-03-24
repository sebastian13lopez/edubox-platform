import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private socket: Socket;
  private serverUrl = 'http://localhost:3000';

  constructor() {
    // Inicializar conexión con el Web Socket de Node.js
    this.socket = io(this.serverUrl);
  }

  // === EMITIR EVENTOS HACIA EL SERVIDOR ===

  unirseAClase(cursoId: string, usuario: any): void {
    // Al entrar al componente de Aula, llamaremos esto
    this.socket.emit('unirse-clase', { cursoId, usuario });
  }

  enviarMensaje(cursoId: string, autor_id: string, texto: string, nombreAutor: string): void {
    this.socket.emit('enviar-mensaje', { cursoId, autor_id, texto, nombreAutor });
  }

  desconectar(): void {
    // Al salir del componente, cortamos el tubo para no gastar recursos
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  // === ESCUCHAR EVENTOS DESDE EL SERVIDOR (OBSERVABLES) ===

  escucharNuevosMensajes(): Observable<any> {
    return new Observable(observer => {
      this.socket.on('nuevo-mensaje', (mensaje) => {
        observer.next(mensaje);
      });
    });
  }

  escucharUsuariosActualizados(): Observable<any[]> {
    return new Observable(observer => {
      this.socket.on('lista-usuarios-actualizada', (usuarios) => {
        observer.next(usuarios); // Emitirá el array cada vez que alguien entre o salga
      });
    });
  }
}
