import { Component, OnInit, ChangeDetectorRef, ViewChild, ElementRef, AfterViewChecked, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VoiceRecognitionService } from '../../services/voice-recognition.service';
import { ChatService } from '../../services/chat.service';
import { AuthService } from '../../services/auth';
import { CursoService } from '../../services/curso.service';
import { AnaliticaService, DashboardStudent, QuizData } from '../../services/analitica.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-profesor-aula-en-vivo',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './aula-en-vivo.component.html',
  styleUrls: ['./aula-en-vivo.component.scss']
})
export class AulaEnVivoComponent implements OnInit, AfterViewChecked, AfterViewInit, OnDestroy {

  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  isUserNearBottom = true; // Control de Smart Scroll

  claseIniciada = false;
  clasePausada  = false;

  tiempoTranscurrido = 0; // en segundos
  cronometroInterval: any;
  cronometroFormateado = '00:00:00';

  isRecording = false;
  
  finishingBuffer = ''; 
  interimText = ''; 

  textosRecientes: any[] = [];
  usuariosActivos: any[] = [];
  mensajesChat: any[] = [];
  claseActual: any = null;
  usuarioActivo: any = null;
  
  isProcessingIA = false;
  errorMsg    = '';
  browserOk   = true;

  // Analítica y Gamificación
  estudiantesAnalytics: DashboardStudent[] = [];
  isGeneratingQuiz = false;
  private analyticsInterval: any;
  resultadosQuizEnVivo: { nombreEstudiante: string; esCorrecta: boolean; respuestaElegida: string; racha: number; timestamp: Date }[] = [];
  mostrarResultadosQuiz = false;
  rachasEstudiantes = new Map<string, number>(); // nombre -> racha actual
  ultimaActualizacion: Date | null = null;

  // Alerta de confusión
  alertaConfusion: { porcentaje: number; cantidad: number; total: number; timestamp: Date } | null = null;
  private alertaConfusionTimeout: any;

  // Tab activo del panel de analítica
  tabAnalitica: 'tabla' | 'ranking' = 'tabla';
  // Tab del panel lateral
  tabPanel: 'chat' | 'analitica' | 'ranking' = 'chat';

  // Toast Notifications
  toasts: { id: number; message: string; type: 'success' | 'error' | 'info' | 'warning' }[] = [];
  private toastIdCounter = 0;

  constructor(
    public  voiceService: VoiceRecognitionService,
    private cdr: ChangeDetectorRef,
    private chatService: ChatService,
    private authService: AuthService,
    private cursoService: CursoService,
    private analiticaService: AnaliticaService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.browserOk = this.voiceService.isSupported();

    // 1. AL CARGAR EL COMPONENTE (Manejo de Caché y Sesión)
    const stored = localStorage.getItem('claseActual');
    if (stored) {
      this.claseActual = JSON.parse(stored);
      this.usuarioActivo = {
        idUsuario: this.authService.getIdUsuario(),
        nombre: this.authService.getNombreUsuario(),
        rol: this.authService.obtenerRol() || 'profesor'
      };
      
      // Conectamos el Tunnel TCP con Socket.io
      this.chatService.unirseAClase(String(this.claseActual.id), this.usuarioActivo);
      
      // Escuchadores Reactivos (Observables de RxJS)
      this.chatService.escucharUsuariosActualizados().subscribe(usuarios => {
        this.usuariosActivos = usuarios;
        this.cdr.detectChanges(); // Forzar repintado del DOM (Online List)
      });
      
      this.chatService.escucharNuevosMensajes().subscribe(mensaje => {
         this.mensajesChat.push(mensaje);
         this.cdr.detectChanges();
      });

      // Iniciar polling del Dashboard de Analítica
      this.cargarDashboardAnalytics();
      this.analyticsInterval = setInterval(() => {
        this.cargarDashboardAnalytics();
      }, 10000);

      // Escuchar resultados de quiz en tiempo real
      this.chatService.escucharResultadosQuiz().subscribe((resultado: any) => {
        this.resultadosQuizEnVivo.unshift(resultado);
        this.mostrarResultadosQuiz = true;
        // Actualizar racha del estudiante
        const rachaActual = resultado.racha || 0;
        this.rachasEstudiantes.set(resultado.nombreEstudiante, rachaActual);
        this.cdr.detectChanges();
      });

      // Escuchar alerta de confusión
      this.chatService.escucharAlertaConfusion().subscribe((alerta: any) => {
        this.alertaConfusion = alerta;
        // Mensaje más accionable según el nivel de confusión
        const pct = alerta.porcentaje;
        let msg = '';
        if (pct >= 50) {
          msg = `⚠️ ¡${pct}% de la clase está perdida! Considera pausar y retomar el último concepto desde el inicio.`;
        } else if (pct >= 30) {
          msg = `${pct}% de la clase no entendió lo último. Intenta dar un ejemplo práctico o reformular la idea.`;
        } else {
          msg = `${alerta.cantidad} estudiante${alerta.cantidad > 1 ? 's' : ''} indicó que se perdió. Podrías preguntar si hay dudas.`;
        }
        this.mostrarToast(msg, 'warning', 10000);
        if (this.alertaConfusionTimeout) clearTimeout(this.alertaConfusionTimeout);
        this.alertaConfusionTimeout = setTimeout(() => {
          this.alertaConfusion = null;
          this.cdr.detectChanges();
        }, 60000); // Mostrar alerta 1 minuto
        this.cdr.detectChanges();
      });
    }

    this.voiceService.finalText$.subscribe(t => { 
      this.finishingBuffer = t;   
      this.cdr.detectChanges(); 
      this.scrollToBottom();
    });
    
    this.voiceService.interimText$.subscribe(t => { 
      this.interimText = t; 

      if (this.claseActual && this.claseIniciada) {
         this.chatService.enviarInterim(String(this.claseActual.id), t);
      }

      this.cdr.detectChanges(); 
      this.scrollToBottom();
    });
    
    this.voiceService.textosRecientes$.subscribe(textos => { 
      this.textosRecientes = textos; 
      
      if (this.claseActual && this.claseIniciada) {
         this.chatService.enviarTranscripcion(String(this.claseActual.id), textos);
      }

      this.cdr.detectChanges(); 
      this.scrollToBottom();
    });

    this.voiceService.isProcessingIA$.subscribe(p => {
      this.isProcessingIA = p;
      this.cdr.detectChanges();
    });

    this.voiceService.isListening$.subscribe(a => { 
      this.isRecording = a; 
      this.cdr.detectChanges(); 
    });
    
    this.voiceService.error$.subscribe(e => { 
      this.errorMsg = e;       
      this.cdr.detectChanges(); 
    });
  }

  ngAfterViewInit() {
    // Listener nativo de scroll para detectar si el usuario subió
    if (this.scrollContainer && this.scrollContainer.nativeElement) {
      this.scrollContainer.nativeElement.addEventListener('scroll', () => this.onScroll());
    }
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  onScroll(): void {
    if (!this.scrollContainer || !this.scrollContainer.nativeElement) return;
    const el = this.scrollContainer.nativeElement;
    // Si la distancia al fondo es menor a 150px, asumimos que sigue leyendo en vivo
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    this.isUserNearBottom = distanceToBottom < 150;
  }

  scrollToBottom(): void {
    try {
      if (this.scrollContainer && this.scrollContainer.nativeElement && this.isUserNearBottom) {
        const el = this.scrollContainer.nativeElement;
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      }
    } catch(err) { }
  }

  iniciarClase(): void {
    this.claseIniciada = true;
    this.clasePausada  = false;
    this.voiceService.start();

    // Notificar a todos los estudiantes de este curso que la clase ha iniciado
    if (this.claseActual) {
      this.notificationService.emitirClaseIniciada(
        String(this.claseActual.id),
        this.claseActual.nombre,
        this.authService.getNombreUsuario() || 'Profesor'
      );
    }

    // Iniciar cronómetro
    this.tiempoTranscurrido = 0;
    this.cronometroFormateado = '00:00:00';
    if (this.cronometroInterval) {
      clearInterval(this.cronometroInterval);
    }
    this.cronometroInterval = setInterval(() => {
      if (!this.clasePausada) {
        this.tiempoTranscurrido++;
        this.actualizarCronometroUI();
      }
    }, 1000);
  }

  actualizarCronometroUI(): void {
    const hrs = Math.floor(this.tiempoTranscurrido / 3600);
    const mins = Math.floor((this.tiempoTranscurrido % 3600) / 60);
    const segs = this.tiempoTranscurrido % 60;
    
    const hStr = hrs < 10 ? '0' + hrs : String(hrs);
    const mStr = mins < 10 ? '0' + mins : String(mins);
    const sStr = segs < 10 ? '0' + segs : String(segs);
    
    this.cronometroFormateado = `${hStr}:${mStr}:${sStr}`;
    this.cdr.detectChanges();
  }

  pausarClase(): void {
    if (!this.claseIniciada) return;
    this.clasePausada = !this.clasePausada;
    this.clasePausada ? this.voiceService.pause() : this.voiceService.start();
  }

  reiniciarClase(): void {
    this.claseIniciada = false;
    this.clasePausada  = false;
    this.voiceService.stop();
    this.voiceService.clear();

    if (this.cronometroInterval) {
      clearInterval(this.cronometroInterval);
    }
    this.tiempoTranscurrido = 0;
    this.cronometroFormateado = '00:00:00';
  }

  /**
   * Módulo de Persistencia y Reportes (Botón Guardar y Salir)
   * Dispara el empaquetamiento del historial a la base de datos REST.
   */
  finalizarYDescargar(): void {
    // 1. Exportación manual a Word
    this.voiceService.descargarTranscripcionWord();

    // Detener cronómetro
    if (this.cronometroInterval) {
      clearInterval(this.cronometroInterval);
    }
    
    // 2. Guardar en MongoDB con feedback visual
    if (this.claseActual && this.voiceService.historialCompleto) {
       this.cursoService.guardarHistorialClase({
          curso_id: this.claseActual.id,
          profesor_id: this.authService.getIdUsuario(),
          textoCompleto: this.voiceService.historialCompleto,
          participantes: this.usuariosActivos.filter(u => u.rol !== 'profesor').map(u => u.nombre),
          duracion: this.tiempoTranscurrido,
          mensajesChat: this.mensajesChat.map(m => ({
            autor: m.autor === 'Tú' ? (this.authService.getNombreUsuario() || 'Profesor') : m.autor,
            texto: m.texto,
            autor_id: m.autor_id || null
          }))
       }).subscribe({
          next: () => {
            this.mostrarToast('Clase guardada en el historial correctamente', 'success');
          },
          error: (err) => {
            console.error('Error al guardar historial:', err);
            this.mostrarToast('Error al guardar la clase. Revisa la conexión con el servidor.', 'error');
          }
       });
    } else {
      this.mostrarToast('Sin transcripción que guardar. Activa el micófono durante la clase.', 'info');
    }

    // 3. Apagar micrófono y restablecer variables
    this.claseIniciada = false;
    this.clasePausada = false;
    this.voiceService.stop();
    this.tiempoTranscurrido = 0;
    this.cronometroFormateado = '00:00:00';
  }

  enviarMensaje(texto: string): void {
    if (!texto.trim()) return;
    const hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    this.mensajesChat.push({ 
      autor: 'Tú', 
      texto, 
      hora, 
      esMio: true, 
      autor_id: this.authService.getIdUsuario() 
    });

    if (this.claseActual) {
      this.chatService.enviarMensaje(
        String(this.claseActual.id),
        this.authService.getIdUsuario(),
        texto,
        this.authService.getNombreUsuario() || 'Profesor'
      );
    }
    
    this.cdr.detectChanges();
  }

  // === GAMIFICACIÓN Y ANALÍTICA ===

  cargarDashboardAnalytics(): void {
    if (!this.claseActual) return;
    this.analiticaService.obtenerDashboard(String(this.claseActual.id)).subscribe({
      next: (data) => {
        // Solo mostrar estudiantes que están conectados ahora mismo via Socket.IO
        const nombresConectados = new Set(
          this.usuariosActivos
            .filter(u => u.rol !== 'profesor')
            .map(u => u.nombre)
        );

        this.estudiantesAnalytics = data.filter(e =>
          nombresConectados.size === 0 || nombresConectados.has(e.nombre)
        );

        this.ultimaActualizacion = new Date();
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error cargando analíticas', err)
    });
  }

  lanzarQuizGemini(): void {
    if (!this.claseActual || this.isGeneratingQuiz) return;
    
    const textoParaQuiz = this.textosRecientes.map(t => t.texto).join(' ');
    
    if (textoParaQuiz.trim().length < 20) {
      this.mostrarToast('No hay suficiente texto transcrito para generar un quiz.', 'info');
      return;
    }

    this.isGeneratingQuiz = true;
    this.cdr.detectChanges();

    this.analiticaService.generarQuiz(textoParaQuiz, String(this.claseActual.id)).subscribe({
      next: (quizData: QuizData) => {
        this.isGeneratingQuiz = false;
        this.chatService.lanzarQuizFlash(String(this.claseActual.id), quizData);
        this.mostrarToast('¡Quiz Flash enviado a todos los estudiantes!', 'success');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isGeneratingQuiz = false;
        const status  = err?.status;
        const tipo    = err?.error?.tipo;
        const espera  = err?.error?.espera;

        if (status === 429) {
          if (tipo === 'cooldown') {
            // El profesor ya lanzó un quiz hace poco
            this.mostrarToast(`Ya enviaste un quiz. Espera ${espera}s para el siguiente.`, 'warning', 6000);
          } else {
            // Gemini está saturado (cuota de API)
            this.mostrarToast('La IA está temporalmente saturada. Intenta en unos segundos.', 'warning', 6000);
          }
        } else {
          const detalle = err?.error?.detalle || 'Error desconocido';
          this.mostrarToast(`Error al generar el quiz: ${detalle}`, 'error');
        }
        this.cdr.detectChanges();
      }
    });
  }

  mostrarToast(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info', duration = 4000): void {
    const id = ++this.toastIdCounter;
    this.toasts.push({ id, message, type });
    this.cdr.detectChanges();
    setTimeout(() => {
      this.toasts = this.toasts.filter(t => t.id !== id);
      this.cdr.detectChanges();
    }, duration);
  }

  /** Número de estudiantes conectados vía Socket.IO (excluye profesores) */
  get estudiantesConectados(): number {
    return this.usuariosActivos.filter(u => u.rol !== 'profesor').length;
  }

  get leaderboard(): DashboardStudent[] {
    // Ordenar: primero los que han participado en quizes, luego por score
    return [...this.estudiantesAnalytics].sort((a, b) => {
      if (b.correctQuizCount !== a.correctQuizCount) return b.correctQuizCount - a.correctQuizCount;
      return b.score - a.score;
    });
  }

  get statsClase() {
    if (!this.estudiantesAnalytics.length) return null;
    const total = this.estudiantesAnalytics.length;
    const enRiesgo = this.estudiantesAnalytics.filter(e => e.estado === 'En Riesgo').length;
    const avgScore = Math.round(this.estudiantesAnalytics.reduce((s, e) => s + e.score, 0) / total);
    const totalQuizes = this.estudiantesAnalytics.reduce((s, e) => s + e.correctQuizCount, 0);
    return { total, enRiesgo, avgScore, totalQuizes, estables: total - enRiesgo };
  }

  ngOnDestroy(): void {
    if (this.analyticsInterval) {
      clearInterval(this.analyticsInterval);
    }
    if (this.cronometroInterval) {
      clearInterval(this.cronometroInterval);
    }
  }
}
