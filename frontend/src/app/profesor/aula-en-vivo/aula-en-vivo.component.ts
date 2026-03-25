import { Component, OnInit, ChangeDetectorRef, ViewChild, ElementRef, AfterViewChecked, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VoiceRecognitionService } from '../../services/voice-recognition.service';
import { ChatService } from '../../services/chat.service';
import { AuthService } from '../../services/auth';
import { CursoService } from '../../services/curso.service';

@Component({
  selector: 'app-profesor-aula-en-vivo',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './aula-en-vivo.component.html',
  styleUrls: ['./aula-en-vivo.component.scss']
})
export class AulaEnVivoComponent implements OnInit, AfterViewChecked, AfterViewInit {

  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  isUserNearBottom = true; // Control de Smart Scroll

  claseIniciada = false;
  clasePausada  = false;

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

  constructor(
    public  voiceService: VoiceRecognitionService,
    private cdr: ChangeDetectorRef,
    private chatService: ChatService,
    private authService: AuthService,
    private cursoService: CursoService
  ) {}

  ngOnInit(): void {
    this.browserOk = this.voiceService.isSupported();

    const stored = localStorage.getItem('claseActual');
    if (stored) {
      this.claseActual = JSON.parse(stored);
      this.usuarioActivo = {
        idUsuario: this.authService.getIdUsuario(),
        nombre: this.authService.getNombreUsuario(),
        rol: this.authService.obtenerRol() || 'profesor'
      };
      
      this.chatService.unirseAClase(String(this.claseActual.id), this.usuarioActivo);
      
      this.chatService.escucharUsuariosActualizados().subscribe(usuarios => {
        this.usuariosActivos = usuarios;
        this.cdr.detectChanges();
      });
      
      this.chatService.escucharNuevosMensajes().subscribe(mensaje => {
         this.mensajesChat.push(mensaje);
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
  }

  finalizarYDescargar(): void {
    // 1. Guardar en documento Word local
    this.voiceService.descargarTranscripcionWord();
    
    // 2. Guardar en la Base de Datos Historial
    if (this.claseActual && this.voiceService.historialCompleto) {
       this.cursoService.guardarHistorialClase({
          curso_id: this.claseActual.id,
          profesor_id: this.authService.getIdUsuario(),
          textoCompleto: this.voiceService.historialCompleto,
          participantes: this.usuariosActivos.map(u => u.nombre)
       }).subscribe({
          next: () => console.log("Historial guardado exitosamente en MongoDB"),
          error: (err) => console.error("Error al guardar historial:", err)
       });
    }

    // 3. Limpiar estado
    this.claseIniciada = false;
    this.clasePausada = false;
    this.voiceService.stop();
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
        this.authService.getNombreUsuario() || 'Profesor'
      );
    }
    
    this.cdr.detectChanges();
  }
}
