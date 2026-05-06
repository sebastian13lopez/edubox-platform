import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { HttpClient } from '@angular/common/http';

export interface TranscripcionItem {
  id: number;
  texto: string;
  isProcessing: boolean;
}

declare var webkitSpeechRecognition: any;
declare var SpeechRecognition: any;

@Injectable({
  providedIn: 'root'
})
export class VoiceRecognitionService {

  private recognition: any;

  private isStoppedByUser = false;
  private hasError = false;
  private isListening = false;

  // ── Historial Completo y Memoria a Corto Plazo ────────────────
  public historialCompleto: string = '';
  public textosRecientes: TranscripcionItem[] = [];
  private textosRecientesSubject = new BehaviorSubject<TranscripcionItem[]>([]);
  readonly textosRecientes$ = this.textosRecientesSubject.asObservable();

  private activeChunkId: number | null = null;
  private sendTimeoutId: any = null;

  public text = '';
  private textSubject = new BehaviorSubject<string>('');
  readonly text$ = this.textSubject.asObservable();

  public isProcessingIA = false;
  private processingSubject = new BehaviorSubject<boolean>(false);
  readonly isProcessingIA$ = this.processingSubject.asObservable();

  // ── Streams públicos (Observable) ───────────────────────────────────
  private finalSubject = new BehaviorSubject<string>('');
  private interimSubject = new BehaviorSubject<string>('');
  private activeSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new BehaviorSubject<string>('');

  readonly finalText$ = this.finalSubject.asObservable();
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

    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'es-ES';
    this.recognition.maxAlternatives = 1;

    // ────────────────────── EVENTO ONRESULT ──────────────────────
    this.recognition.onresult = (event: any) => {
      let interim = '';

      // EL USUARIO ESTÁ HABLANDO: Cancelamos cualquier temporizador de silencio previo
      if (this.sendTimeoutId) {
        clearTimeout(this.sendTimeoutId);
        this.sendTimeoutId = null;
      }

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

            const textoLimpio = transcript.trim();
            if (!textoLimpio) return;

            // Buscamos si hay un bloque activo aguantando palabras
            let chunk = this.textosRecientes.find(t => t.id === this.activeChunkId);

            if (!chunk) {
              // Si no existe, creamos el bloque
              this.activeChunkId = Date.now() + Math.random();
              chunk = { id: this.activeChunkId, texto: textoLimpio, isProcessing: false };
              this.textosRecientes.push(chunk);
            } else {
              // Si existe, le sumamos el texto fresco
              chunk.texto += ' ' + textoLimpio;
            }

            if (this.textosRecientes.length > 3) {
              this.textosRecientes.shift();
            }
            this.textosRecientesSubject.next([...this.textosRecientes]);

            // Contamos palabras del bloque acumulado
            const wordsCount = chunk.texto.split(/\s+/).filter(w => w.length > 0).length;

            if (this.sendTimeoutId) {
              clearTimeout(this.sendTimeoutId);
              this.sendTimeoutId = null;
            }

            // REGLA: Disparar IA si hay >= 15 palabras
            if (wordsCount >= 15) {
              chunk.isProcessing = true;
              this.textosRecientesSubject.next([...this.textosRecientes]);
              this.corregirTextoConIA(chunk.texto, chunk.id);
              this.activeChunkId = null;
            } else {
              // REGLA: Si no hay 15 palabras, esperar 3s de silencio absoluto para disparar
              const currentId = chunk.id;
              this.sendTimeoutId = setTimeout(() => {
                if (this.activeChunkId === currentId) {
                  const targetChunk = this.textosRecientes.find(t => t.id === currentId);
                  if (targetChunk) {
                    targetChunk.isProcessing = true;
                    this.textosRecientesSubject.next([...this.textosRecientes]);
                    this.corregirTextoConIA(targetChunk.texto, currentId);
                  }
                  this.activeChunkId = null;
                }
              }, 3000);
            }
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
      console.warn('[Eduvox Voice] Error de reconocimiento:', err);

      // Solo son errores fatales los que requieren interacción del usuario
      const fatal = ['not-allowed', 'service-not-allowed'];

      if (fatal.includes(err)) {
        this.hasError = true;
        this.isStoppedByUser = true;
        this.zone.run(() => {
          this.activeSubject.next(false);
          const messages: Record<string, string> = {
            'not-allowed': 'Permiso de micrófono denegado.',
            'service-not-allowed': 'El servicio de voz no está permitido.',
          };
          this.errorSubject.next(messages[err] ?? `Error de voz: ${err}`);
        });
      }
      // 'no-speech', 'network', 'aborted' -> no fatales, el onend los reanudará
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.zone.run(() => this.activeSubject.next(false));

      // Reiniciar automáticamente si no fue el usuario quien detuvo
      if (!this.isStoppedByUser && !this.hasError) {
        // Pequeña espera para evitar bucle rápido en Chrome
        setTimeout(() => {
          if (!this.isStoppedByUser && !this.hasError) {
            try {
              this.recognition.start();
              this.isListening = true;
              this.zone.run(() => this.activeSubject.next(true));
            } catch (_) { }
          }
        }, 300);
      }
    };
  }

  // ──────────────── PROCESO HACIA LA IA ──────────────────────────

  private corregirTextoConIA(textoBruto: string, id: number): void {
    if (!textoBruto.trim()) return;

    this.isProcessingIA = true;
    this.processingSubject.next(true);

    const url = `http://localhost:3000/api/analitica/corregir-ortografia`;

    this.http.post<any>(url, { texto: textoBruto }).subscribe({
      next: (response) => {
        try {
          const textoCorregido = response.textoCorregido;
          this.zone.run(() => {
            this.reemplazarTextoCorregido(id, textoCorregido);
            this.isProcessingIA = false;
            this.processingSubject.next(false);
          });
        } catch (error) {
          console.error('[Eduvox Voice] Error procesando corrección:', error);
          this.fallbackToRawText(id, textoBruto);
        }
      },
      error: (err) => {
        console.warn('[Eduvox Voice] Advertencia/Error de servidor backend al corregir ortografía:', err);
        this.fallbackToRawText(id, textoBruto);
      }
    });

    // Limpia las variables de estado visual de Angular por seguridad.
    this.finalSubject.next('');
    this.interimSubject.next('');
  }

  private fallbackToRawText(id: number, textoBruto: string): void {
    this.zone.run(() => {
      this.reemplazarTextoCorregido(id, textoBruto);
      this.isProcessingIA = false;
      this.processingSubject.next(false);
    });
  }

  private reemplazarTextoCorregido(id: number, textoCorregido: string): void {
    // Buscar en la cola visual y actualizar
    const item = this.textosRecientes.find(t => t.id === id);
    if (item) {
      item.texto = textoCorregido;
      item.isProcessing = false;
    }
    this.textosRecientesSubject.next([...this.textosRecientes]);

    // 1. Agregar al historial maestro (para Word)
    this.historialCompleto += (this.historialCompleto.length > 0 ? '\n\n' : '') + textoCorregido;
    this.text += (this.text.length > 0 ? ' ' : '') + textoCorregido;
    this.textSubject.next(this.text);
  }

  // ── API y Limpieza Controlada ──────────────────────────────────────────

  start(): void {
    if (!this.recognition) return;

    this.isStoppedByUser = false;
    this.hasError = false;
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
    if (this.sendTimeoutId) {
      clearTimeout(this.sendTimeoutId);
      this.sendTimeoutId = null;
    }
    this.activeChunkId = null;

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
