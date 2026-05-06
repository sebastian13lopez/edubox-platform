import { Component, OnInit, ChangeDetectorRef, HostListener, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { VoiceRecognitionService } from '../../services/voice-recognition.service';
import { ChatService } from '../../services/chat.service';
import { AuthService } from '../../services/auth';
import { AnaliticaService, QuizData } from '../../services/analitica.service';
import { MensajeChat, ClaseActiva } from '../../models/models';

@Component({
  selector: 'app-estudiante-aula-en-vivo',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './aula-en-vivo.component.html',
  styleUrls: ['./aula-en-vivo.component.scss']
})
export class AulaEnVivoComponent implements OnInit, OnDestroy {

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

  // Quiz Flash
  quizFlashActivo = false;
  quizFlashData: QuizData | null = null;
  quizTimer = 30;
  private quizInterval: any;
  respuestaSeleccionada: string | null = null;
  quizResultado: 'correcto' | 'incorrecto' | null = null;

  // Gamificación: Racha y Confusión
  racha = 0;
  puntosSesion = 0;
  tiempoEnClaseMinutos = 0;
  confusionEnfriamiento = false; // Cooldown de 30s para no hacer spam
  confusionEstado: { cantidad: number; total: number; porcentaje: number } | null = null;
  mostrarFeedbackConfusion = false;
  private tiempoInterval: any;

  constructor(
    public  voiceService: VoiceRecognitionService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private chatService: ChatService,
    private authService: AuthService,
    private analiticaService: AnaliticaService
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

      this.chatService.escucharQuizFlash().subscribe((quizData: QuizData) => {
         this.mostrarQuizFlash(quizData);
      });

      // Escuchar estado de confusión (cuántos estudiantes están confundidos)
      this.chatService.escucharEstadoConfusion().subscribe((estado) => {
        this.confusionEstado = estado;
        this.cdr.detectChanges();
      });

      // Timer de tiempo en clase (racha por asistencia)
      this.tiempoInterval = setInterval(() => {
        this.tiempoEnClaseMinutos++;
        // Cada 5 minutos en clase = +1 punto de racha de asistencia
        if (this.tiempoEnClaseMinutos % 5 === 0) {
          this.analiticaService.registrarEvento(
            this.authService.getIdUsuario(),
            String(this.claseActual!.id),
            'tiempo_clase',
            1
          ).subscribe();
        }
        this.cdr.detectChanges();
      }, 60000); // cada minuto
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
    this.enviarMensaje(`[Pregunta rápida]: ${tipo}`);
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

  // === TRACKER DE ATENCIÓN ===
  @HostListener('document:visibilitychange')
  handleVisibilityChange() {
    if (document.hidden && this.enClase && this.claseActual) {
      // El estudiante minimizó o cambió de pestaña
      this.analiticaService.registrarEvento(
        this.authService.getIdUsuario(),
        String(this.claseActual.id),
        'tab_focus_lost'
      ).subscribe();
    }
  }

  // === QUIZ FLASH ===
  mostrarQuizFlash(quizData: QuizData): void {
    this.quizFlashData = quizData;
    this.quizFlashActivo = true;
    this.quizTimer = 30;
    this.respuestaSeleccionada = null;
    this.quizResultado = null;
    this.cdr.detectChanges();

    this.quizInterval = setInterval(() => {
      this.quizTimer--;
      if (this.quizTimer <= 0) {
        this.cerrarQuizFlash();
      }
      this.cdr.detectChanges();
    }, 1000);
  }

  responderQuiz(opcion: string): void {
    if (!this.quizFlashData || this.quizResultado !== null) return;
    
    this.respuestaSeleccionada = opcion;
    const esCorrecta = opcion === this.quizFlashData.correcta;
    this.quizResultado = esCorrecta ? 'correcto' : 'incorrecto';
    
    // Enviar resultado al backend (analytics)
    if (this.enClase && this.claseActual) {
      this.analiticaService.registrarEvento(
        this.authService.getIdUsuario(),
        String(this.claseActual.id),
        esCorrecta ? 'quiz_answered_correct' : 'quiz_answered_incorrect',
        esCorrecta ? 10 : 2
      ).subscribe();

      // Actualizar racha local
      if (esCorrecta) {
        this.racha++;
        this.puntosSesion += 10;
      } else {
        this.racha = 0; // Rompe la racha si falla
        this.puntosSesion += 2;
      }

      // Emitir respuesta en tiempo real al profesor vía WebSocket (con racha)
      this.chatService.emitirRespuestaQuiz(
        String(this.claseActual.id),
        this.authService.getNombreUsuario() || 'Estudiante',
        esCorrecta,
        opcion,
        this.racha
      );
    }

    this.cdr.detectChanges();

    // Cerrar después de 3 segundos de ver el resultado
    setTimeout(() => {
      this.cerrarQuizFlash();
    }, 3000);
  }

  cerrarQuizFlash(): void {
    this.quizFlashActivo = false;
    this.quizFlashData = null;
    clearInterval(this.quizInterval);
    this.cdr.detectChanges();
  }

  ngOnDestroy(): void {
    if (this.quizInterval) clearInterval(this.quizInterval);
    if (this.tiempoInterval) clearInterval(this.tiempoInterval);
  }

  // === BOTÓN DE CONFUSIÓN ===
  reportarConfusion(): void {
    if (!this.enClase || !this.claseActual || this.confusionEnfriamiento) return;
    
    this.confusionEnfriamiento = true;
    this.mostrarFeedbackConfusion = true;
    
    // Registrar en analytics
    this.analiticaService.registrarEvento(
      this.authService.getIdUsuario(),
      String(this.claseActual.id),
      'confusion_reported',
      1
    ).subscribe();

    // Emitir por Socket al servidor
    this.chatService.emitirConfusion(
      String(this.claseActual.id),
      this.authService.getIdUsuario()
    );

    this.cdr.detectChanges();

    // Ocultar feedback después de 2s y aplicar cooldown de 30s
    setTimeout(() => {
      this.mostrarFeedbackConfusion = false;
      this.cdr.detectChanges();
    }, 2000);
    setTimeout(() => {
      this.confusionEnfriamiento = false;
      this.cdr.detectChanges();
    }, 30000);
  }
}
