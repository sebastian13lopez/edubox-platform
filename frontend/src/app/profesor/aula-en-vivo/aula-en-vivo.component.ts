import { Component, OnInit, ChangeDetectorRef, ViewChild, ElementRef, AfterViewChecked, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VoiceRecognitionService } from '../../services/voice-recognition.service';

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
  
  isProcessingIA = false;
  errorMsg    = '';
  browserOk   = true;

  constructor(
    public  voiceService: VoiceRecognitionService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.browserOk = this.voiceService.isSupported();

    this.voiceService.finalText$.subscribe(t => { 
      this.finishingBuffer = t;   
      this.cdr.detectChanges(); 
      this.scrollToBottom();
    });
    
    this.voiceService.interimText$.subscribe(t => { 
      this.interimText = t; 
      this.cdr.detectChanges(); 
      this.scrollToBottom();
    });
    
    this.voiceService.textosRecientes$.subscribe(textos => { 
      this.textosRecientes = textos; 
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
    this.voiceService.descargarTranscripcionWord();
    this.claseIniciada = false;
    this.clasePausada = false;
    this.voiceService.stop();
  }
}
