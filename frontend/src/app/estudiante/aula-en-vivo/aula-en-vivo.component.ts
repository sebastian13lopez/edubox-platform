import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { VoiceRecognitionService } from '../../services/voice-recognition.service';
import { ChatService } from '../../services/chat.service';
import { AuthService } from '../../services/auth';
import { MensajeChat, ClaseActiva } from '../../models/models';

@Component({
  selector: 'app-estudiante-aula-en-vivo',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './aula-en-vivo.component.html',
  styleUrls: ['./aula-en-vivo.component.scss']
})
export class AulaEnVivoComponent implements OnInit {

  claseActual: ClaseActiva | null = null;
  enClase     = false;

  // Transcripción en vivo
  isRecording = false;
  textosRecientes: any[] = [];
  usuariosActivos: any[] = [];
  finalText   = '';
  interimText = '';
  errorMsg    = '';
  browserOk   = true;

  // Chat
  mensajesChat: MensajeChat[] = [];

  constructor(
    public  voiceService: VoiceRecognitionService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private chatService: ChatService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.browserOk = this.voiceService.isSupported();

    // Recupera la clase a la que el estudiante se unió
    const stored = localStorage.getItem('claseActual');
    if (stored) {
      this.claseActual = JSON.parse(stored);
      this.enClase     = true;
      this.voiceService.clear();

      const usuarioActivo = {
        idUsuario: this.authService.getIdUsuario(),
        nombre: this.authService.getNombreUsuario(),
        rol: 'estudiante'
      };

      this.chatService.unirseAClase(String(this.claseActual!.id), usuarioActivo);

      this.chatService.escucharUsuariosActualizados().subscribe(usuarios => {
        this.usuariosActivos = usuarios;
        this.cdr.detectChanges();
      });

      this.chatService.escucharTranscripcion().subscribe(textos => {
        this.textosRecientes = textos;
        this.cdr.detectChanges();
      });
      
      this.chatService.escucharInterim().subscribe(interim => {
        this.interimText = interim;
        this.cdr.detectChanges();
      });

      this.chatService.escucharNuevosMensajes().subscribe(mensaje => {
         this.mensajesChat.push(mensaje);
         this.cdr.detectChanges();
      });
    }

    // this.voiceService.textosRecientes$.subscribe(textos => { this.textosRecientes = textos; this.cdr.detectChanges(); }); // Sustituido por Socket.io
    this.voiceService.text$.subscribe(t   => { this.finalText   = t;     this.cdr.detectChanges(); });
    this.voiceService.isListening$.subscribe(a  => { this.isRecording = a;    this.cdr.detectChanges(); });
    this.voiceService.error$.subscribe(e        => { this.errorMsg    = e; this.cdr.detectChanges(); });
  }

  abandonarClase(): void {
    if (confirm('¿Seguro que deseas salir de la clase?')) {
      this.enClase = false;
      this.claseActual = null;
      localStorage.removeItem('claseActual');
      this.voiceService.stop();
      this.router.navigate(['/estudiante/inicio']);
    }
  }

  enviarPreguntaRapida(tipo: string): void {
    this.enviarMensaje(`🙋‍♂️ Pregunta rápida: ${tipo}`);
  }

  enviarMensaje(texto: string): void {
    if (!texto.trim()) return;
    const hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    this.mensajesChat.push({ autor: 'Tú', texto, hora, esMio: true });

    if (this.claseActual) {
      this.chatService.enviarMensaje(
        String(this.claseActual.id),
        this.authService.getIdUsuario(),
        texto,
        this.authService.getNombreUsuario() || 'Estudiante'
      );
    }
    
    this.cdr.detectChanges();
  }
}
