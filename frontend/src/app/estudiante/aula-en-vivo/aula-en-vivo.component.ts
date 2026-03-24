import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { VoiceRecognitionService } from '../../services/voice-recognition.service';
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
  finalText   = '';
  interimText = '';
  errorMsg    = '';
  browserOk   = true;

  // Chat
  mensajesChat: MensajeChat[] = [];

  constructor(
    public  voiceService: VoiceRecognitionService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.browserOk = this.voiceService.isSupported();

    // Recupera la clase a la que el estudiante se unió
    const stored = localStorage.getItem('claseActual');
    if (stored) {
      this.claseActual = JSON.parse(stored);
      this.enClase     = true;
      this.voiceService.clear();
    }

    this.voiceService.textosRecientes$.subscribe(textos => { this.textosRecientes = textos; this.cdr.detectChanges(); });
    this.voiceService.text$.subscribe(t   => { this.finalText   = t;     this.cdr.detectChanges(); });
    this.voiceService.interimText$.subscribe(t  => { this.interimText = t;    this.cdr.detectChanges(); });
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
    alert(`¡Has enviado la solicitud de "${tipo}" al profesor!`);
  }

  enviarMensaje(texto: string): void {
    if (!texto.trim()) return;
    const hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    this.mensajesChat.push({ autor: 'Tú', texto, hora, esMio: true });
  }
}
