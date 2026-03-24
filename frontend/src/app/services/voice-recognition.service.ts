import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { HttpClient } from '@angular/common/http';

declare var webkitSpeechRecognition: any;
declare var SpeechRecognition: any;

@Injectable({
  providedIn: 'root'
})
export class VoiceRecognitionService {

  private recognition: any;

  private isStoppedByUser = false;  
  private hasError       = false;   
  private isListening    = false;   

  // ── Historial Completo y Memoria a Corto Plazo ────────────────
  public historialCompleto: string = '';
  public textosRecientes: string[] = []; 
  private textosRecientesSubject = new BehaviorSubject<string[]>([]);
  readonly textosRecientes$ = this.textosRecientesSubject.asObservable();

  public text = ''; 
  private textSubject = new BehaviorSubject<string>('');
  readonly text$ = this.textSubject.asObservable(); 

  // ── Integración con Gemini IA ─────────────────────────────────────────
  private readonly API_KEY = 'AIzaSyC6Ok76j4Q-Su4DRvvgWdiADnnmDCDZaxc';
  
  public isProcessingIA = false; 
  private processingSubject = new BehaviorSubject<boolean>(false);
  readonly isProcessingIA$ = this.processingSubject.asObservable();

  // ── Streams públicos (Observable) ───────────────────────────────────
  private finalSubject   = new BehaviorSubject<string>('');
  private interimSubject = new BehaviorSubject<string>('');
  private activeSubject  = new BehaviorSubject<boolean>(false);
  private errorSubject   = new BehaviorSubject<string>('');

  readonly finalText$   = this.finalSubject.asObservable();
  readonly interimText$ = this.interimSubject.asObservable();
  readonly isListening$ = this.activeSubject.asObservable();
  readonly error$ = this.errorSubject.asObservable();

  constructor(private zone: NgZone, private http: HttpClient) {
    this.init();
  }

  private init(): void {
    const IWindow = window as any;
    const SpeechRec = IWindow.SpeechRecognition || IWindow.webkitSpeechRecognition;

    if (!SpeechRec) {
      console.warn('[Eduvox Voice] SpeechRecognition no está disponible en este navegador.');
      return;
    }

    this.recognition = new SpeechRec();

    this.recognition.continuous      = true;   
    this.recognition.interimResults  = true;   
    this.recognition.lang            = 'es-ES'; 
    this.recognition.maxAlternatives = 1;       

    // ────────────────────── EVENTO ONRESULT ──────────────────────
    this.recognition.onresult = (event: any) => {
      let interim = '';

      // Iteramos estrictamente sobre los resultados desde el cursor nativo index
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;

        // La magia de la delegación nativa de pausa: 
        if (event.results[i].isFinal) {
          // El navegador dictaminó matemáticamente que el usuario hizo una pausa silenciosa.
          this.zone.run(() => {
            // Limpiamos los textos en progreso de la interfaz:
            this.finalSubject.next(''); 
            this.interimSubject.next('');
            
            // Disparamos INMEDIATAMENTE la frase a Gemini, sin depender de ningún setTimeout.
            this.corregirTextoConIA(transcript);
          });
        } else {
          // Continuamos acumulando visualización interina real-time
          interim += transcript;
        }
      }

      // Si quedaron textos interinos o la persona apenas abrió la boca, los mostramos
      this.zone.run(() => {
        if (interim) {
          this.interimSubject.next(interim);
        } else if (event.results.length === 0) {
          this.interimSubject.next('');
        }
      });
    };

    this.recognition.onerror = (event: any) => {
      const err = event.error as string;
      console.error('[Eduvox Voice] Error:', err);

      const fatal = ['not-allowed', 'service-not-allowed', 'network', 'no-speech'];
      if (fatal.includes(err)) {
        this.hasError = true;
        this.isStoppedByUser = true;
        
        this.zone.run(() => {
          this.activeSubject.next(false);
          const messages: Record<string, string> = {
            'not-allowed':         'Permiso de micrófono denegado.',
            'service-not-allowed': 'El servicio de voz no está permitido.',
            'network':             'Sin conexión a internet.',
            'no-speech':           'No se detectó voz. Habla más cerca del micrófono.',
          };
          this.errorSubject.next(messages[err] ?? `Error de voz: ${err}`);
        });
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.zone.run(() => this.activeSubject.next(false));

      // Reanudación automatizada de Chrome si mató el hilo de fondo
      if (!this.isStoppedByUser && !this.hasError) {
        try {
          this.recognition.start();
          this.isListening = true;
          this.zone.run(() => this.activeSubject.next(true));
        } catch (_) { }
      }
    };
  }

  // ──────────────── PROCESO HACIA LA IA ──────────────────────────

  private corregirTextoConIA(textoBruto: string): void {
    if (!textoBruto.trim()) return;

    this.isProcessingIA = true;
    this.processingSubject.next(true);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.API_KEY}`;
    
    // Prompt estricto del sistema para Gemini
    const prompt = `Actúa como un corrector ortográfico. Corrige la ortografía y agrega signos de puntuación al siguiente texto. NO agregues comentarios, NO cambies las palabras originales, NO respondas a preguntas, solo devuelve el texto corregido.\n\nTexto: ${textoBruto}`;

    const body = {
      contents: [{
        parts: [{ text: prompt }]
      }]
    };

    this.http.post<any>(url, body).subscribe({
      next: (response) => {
        try {
          const textoCorregido = response.candidates[0].content.parts[0].text.trim();
          this.zone.run(() => {
            this.añadirTextoCorregido(textoCorregido);
            this.isProcessingIA = false;
            this.processingSubject.next(false);
          });
        } catch (error) {
          console.error('[Eduvox Voice] Error parseando IA:', error);
          this.fallbackToRawText(textoBruto);
        }
      },
      error: (err) => {
        console.warn('[Eduvox Voice] Advertencia/Error de Gemini (posible 429 Too Many Requests):', err);
        this.fallbackToRawText(textoBruto);
      }
    });

    // Limpia las variables de estado visual de Angular por seguridad.
    this.finalSubject.next('');
    this.interimSubject.next('');
  }

  private fallbackToRawText(textoBruto: string): void {
    this.zone.run(() => {
      this.añadirTextoCorregido(textoBruto);
      this.isProcessingIA = false;
      this.processingSubject.next(false);
    });
  }

  private añadirTextoCorregido(texto: string): void {
    // 1. Agregar al historial maestro (para Word) sin borrar NADA.
    this.historialCompleto += (this.historialCompleto.length > 0 ? '\n\n' : '') + texto;
    this.text += (this.text.length > 0 ? ' ' : '') + texto;
    this.textSubject.next(this.text);

    // 2. LÍMITE ESTRICTO: Solo las últimas 3 frases vivas
    this.textosRecientes.push(texto);
    if (this.textosRecientes.length > 3) {
      this.textosRecientes.shift(); 
    }
    
    // Emitir el arreglo forzando que Angular detecte variables y dispare la transición CSS del Componente
    this.textosRecientesSubject.next([...this.textosRecientes]);
  }

  // ── API y Limpieza Controlada ──────────────────────────────────────────

  start(): void {
    if (!this.recognition) return;

    this.isStoppedByUser = false;
    this.hasError        = false;
    this.errorSubject.next('');

    if (!this.isListening) {
      try {
        this.recognition.start();
        this.isListening = true;
        this.zone.run(() => this.activeSubject.next(true));
      } catch (_) { }
    }
  }

  pause(): void {
    this.isStoppedByUser = true;
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
  }

  stop(): void {
    this.isStoppedByUser = true;
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
  }

  clearAllHistory(): void {
    this.finalSubject.next('');
    this.interimSubject.next('');
    
    this.text = '';
    this.historialCompleto = '';
    this.textosRecientes = [];
    
    this.textSubject.next('');
    this.textosRecientesSubject.next([]);
    this.errorSubject.next('');
  }

  clear(): void {
    this.clearAllHistory();
  }

  // ── Exportación ───────────────────────────────────────────────
  descargarTranscripcionWord(): void {
    if (!this.historialCompleto) return; 

    const parrafos = this.historialCompleto.split('\n').filter(p => p.trim() !== '');
    
    let htmlContent = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>Transcripción de Clase - Eduvox</title></head>
      <body>
        <h1>Transcripción de Clase - Eduvox</h1><hr>
    `;
    parrafos.forEach(p => { htmlContent += `<p>${p}</p>`; });
    htmlContent += `</body></html>`;

    const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'clase_eduvox.doc';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  isSupported(): boolean {
    const IWindow = window as any;
    return !!(IWindow.SpeechRecognition || IWindow.webkitSpeechRecognition);
  }
}
