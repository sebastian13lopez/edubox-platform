import { environment } from '@env/environment';
import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private socket: Socket;
  private serverUrl = environment.wsUrl;

  constructor() {
    // Inicializar conexión con el Web Socket de Node.js
    // transports: intentar WebSocket primero, fallback a polling (necesario en Render)
    this.socket = io(this.serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });

    this.socket.on('connect', () => {
      console.log('🔌 Socket.IO conectado:', this.socket.id);
    });
    this.socket.on('connect_error', (err: any) => {
      console.warn('⚠️ Socket.IO error de conexión:', err.message);
    });
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

  // === TRANSCRIPCIÓN REAL-TIME ===

  enviarTranscripcion(cursoId: string, textos: any[]): void {
    this.socket.emit('transmision-texto', { cursoId, textos });
  }

  escucharTranscripcion(): Observable<any[]> {
    return new Observable(observer => {
      this.socket.on('actualizacion-transcripcion', (textos) => {
        observer.next(textos);
      });
    });
  }

  enviarInterim(cursoId: string, interimText: string): void {
    this.socket.emit('transmision-interim', { cursoId, interimText });
  }

  escucharInterim(): Observable<string> {
    return new Observable(observer => {
      this.socket.on('actualizacion-interim', (interim) => {
        observer.next(interim);
      });
    });
  }

  // === ESCUCHAR EVENTOS DESDE EL SERVIDOR (OBSERVABLES) ===

  escucharQuizFlash(): Observable<any> {
    return new Observable(observer => {
      this.socket.on('nuevo-quiz-flash', (quizData) => {
        observer.next(quizData);
      });
    });
  }

  lanzarQuizFlash(cursoId: string, quizData: any): void {
    this.socket.emit('lanzar-quiz-flash', { cursoId, quizData });
  }

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
        observer.next(usuarios);
      });
    });
  }

  emitirRespuestaQuiz(cursoId: string, nombreEstudiante: string, esCorrecta: boolean, respuestaElegida: string, racha: number = 0): void {
    this.socket.emit('respuesta-quiz', { cursoId, nombreEstudiante, esCorrecta, respuestaElegida, racha });
  }

  escucharResultadosQuiz(): Observable<any> {
    return new Observable(observer => {
      this.socket.on('resultado-quiz-estudiante', (resultado) => {
        observer.next(resultado);
      });
    });
  }

  emitirConfusion(cursoId: string, estudianteId: string): void {
    this.socket.emit('estudiante-confundido', { cursoId, estudianteId });
  }

  escucharAlertaConfusion(): Observable<any> {
    return new Observable(observer => {
      this.socket.on('alerta-confusion', (alerta) => {
        observer.next(alerta);
      });
    });
  }

  escucharEstadoConfusion(): Observable<any> {
    return new Observable(observer => {
      this.socket.on('estado-confusion', (estado) => {
        observer.next(estado);
      });
    });
  }
}
