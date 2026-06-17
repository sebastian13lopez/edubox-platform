import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PqrsService, PQRS } from '../../services/pqrs.service';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-pqrs-estudiante',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="min-h-screen bg-slate-50 p-6">
  <div class="max-w-4xl mx-auto">

    <!-- Encabezado -->
    <div class="mb-8">
      <h1 class="text-3xl font-extrabold text-slate-800 tracking-tight">PQRS</h1>
      <p class="text-slate-500 mt-1">Peticiones, Quejas, Reclamos y Sugerencias</p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">

      <!-- ── FORMULARIO NUEVA PQRS ── -->
      <div class="bg-white rounded-3xl shadow-sm border border-slate-100 p-7">
        <h2 class="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2">
          <span class="w-8 h-8 bg-violet-100 text-violet-600 rounded-xl flex items-center justify-center">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
            </svg>
          </span>
          Nueva Solicitud
        </h2>

        <form (ngSubmit)="crearPQRS()" class="space-y-4">
          <!-- Tipo -->
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Tipo de solicitud</label>
            <div class="grid grid-cols-2 gap-2">
              <button *ngFor="let t of tipos" type="button"
                class="py-2.5 px-3 rounded-xl text-sm font-semibold border-2 transition-all duration-200"
                [ngClass]="form.tipo === t
                  ? 'border-violet-500 bg-violet-50 text-violet-700'
                  : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-300'"
                (click)="form.tipo = t">
                {{ t }}
              </button>
            </div>
          </div>

          <!-- Asunto -->
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Asunto</label>
            <input type="text" [(ngModel)]="form.asunto" name="asunto" required maxlength="150"
              placeholder="Resumen breve de tu solicitud..."
              class="w-full px-4 py-3 bg-slate-50 rounded-2xl border border-slate-200 text-slate-700 font-medium outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all placeholder-slate-400 text-sm">
            <p class="text-right text-xs text-slate-400 mt-1">{{ form.asunto.length }}/150</p>
          </div>

          <!-- Descripción -->
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Descripción</label>
            <textarea [(ngModel)]="form.descripcion" name="descripcion" required rows="4"
              placeholder="Describe tu solicitud con el mayor detalle posible..."
              class="w-full px-4 py-3 bg-slate-50 rounded-2xl border border-slate-200 text-slate-700 font-medium outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all placeholder-slate-400 text-sm resize-none"></textarea>
          </div>

          <!-- Botón enviar -->
          <button type="submit" [disabled]="enviando || !form.tipo || !form.asunto || !form.descripcion"
            class="w-full py-3.5 bg-violet-600 text-white font-bold rounded-2xl hover:bg-violet-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            <svg *ngIf="!enviando" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
            </svg>
            <span *ngIf="enviando" class="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
            {{ enviando ? 'Enviando...' : 'Enviar Solicitud' }}
          </button>

          <!-- Feedback -->
          <div *ngIf="mensaje" class="rounded-2xl px-4 py-3 text-sm font-semibold flex items-center gap-2"
            [ngClass]="exito ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'">
            <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path *ngIf="exito" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              <path *ngIf="!exito" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
            {{ mensaje }}
          </div>
        </form>
      </div>

      <!-- ── MIS PQRS ── -->
      <div class="bg-white rounded-3xl shadow-sm border border-slate-100 p-7">
        <h2 class="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2">
          <span class="w-8 h-8 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
          </span>
          Mis Solicitudes
        </h2>

        <!-- Cargando -->
        <div *ngIf="cargando" class="flex justify-center py-10">
          <div class="w-8 h-8 border-2 border-violet-200 border-t-violet-600 rounded-full animate-spin"></div>
        </div>

        <!-- Sin resultados -->
        <div *ngIf="!cargando && misPQRS.length === 0" class="text-center py-10">
          <div class="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <svg class="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
            </svg>
          </div>
          <p class="text-slate-500 font-medium text-sm">No tienes solicitudes aún.</p>
          <p class="text-slate-400 text-xs mt-1">Crea una desde el formulario.</p>
        </div>

        <div *ngIf="errorHttp" class="text-center py-10 bg-red-50 text-red-600 font-bold rounded-2xl">
          Error HTTP: {{ errorHttp | json }}
        </div>

        <!-- Lista de PQRS -->
        <div class="space-y-3 max-h-[520px] overflow-y-auto pr-1">
          <div *ngFor="let p of misPQRS"
            class="rounded-2xl border p-4 cursor-pointer hover:shadow-md transition-all duration-200"
            [ngClass]="getEstadoCardClass(p.estado)"
            (click)="verDetalle(p)">

            <div class="flex items-start justify-between gap-2 mb-2">
              <div>
                <span class="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                  [ngClass]="getTipoClass(p.tipo)">{{ p.tipo }}</span>
                <p class="font-bold text-slate-800 text-sm mt-1.5 leading-tight">{{ p.asunto }}</p>
              </div>
              <span class="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full flex-shrink-0"
                [ngClass]="getEstadoBadgeClass(p.estado)">{{ p.estado }}</span>
            </div>

            <p class="text-xs text-slate-500 font-mono mt-1">{{ p.radicado }}</p>
            <p class="text-xs text-slate-400 mt-0.5">{{ p.createdAt | date:'d MMM yyyy' }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- ── MODAL DETALLE ── -->
    <div *ngIf="pqrsDetalle" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" (click)="cerrarDetalle()">
      <div class="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8" (click)="$event.stopPropagation()">
        <div class="flex items-start justify-between mb-6">
          <div>
            <h3 class="text-xl font-extrabold text-slate-800">{{ pqrsDetalle.pqrs.asunto }}</h3>
            <p class="text-sm font-mono text-violet-600 mt-0.5">{{ pqrsDetalle.pqrs.radicado }}</p>
          </div>
          <button (click)="cerrarDetalle()" class="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div class="space-y-4">
          <div class="bg-slate-50 rounded-2xl p-4">
            <p class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Tu solicitud</p>
            <p class="text-sm text-slate-700 leading-relaxed">{{ pqrsDetalle.pqrs.descripcion }}</p>
          </div>

          <!-- Respuesta del admin -->
          <div *ngIf="pqrsDetalle.respuesta" class="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
            <p class="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
              Respuesta del Administrador
            </p>
            <p class="text-sm text-slate-700 leading-relaxed">{{ pqrsDetalle.respuesta.contenido }}</p>
            <p class="text-xs text-slate-400 mt-2">
              {{ pqrsDetalle.respuesta.createdAt | date:'d MMM yyyy, h:mm a' }}
              <span *ngIf="pqrsDetalle.respuesta.correoEnviado" class="ml-2 text-emerald-500">✓ Correo con PDF enviado</span>
            </p>
          </div>

          <!-- Sin respuesta aún -->
          <div *ngIf="!pqrsDetalle.respuesta" class="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-700 font-medium">
            ⏳ Tu solicitud está siendo revisada. Recibirás un correo con la respuesta.
          </div>
        </div>
      </div>
    </div>

  </div>
</div>
  `
})
export class PqrsEstudianteComponent implements OnInit {
  tipos = ['Petición', 'Queja', 'Reclamo', 'Sugerencia'];

  form = { tipo: '', asunto: '', descripcion: '' };
  enviando = false;
  mensaje = '';
  exito = false;

  misPQRS: PQRS[] = [];
  cargando = true;
  pqrsDetalle: any = null;
  errorHttp: any = null;

  constructor(
    private pqrsService: PqrsService, 
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.cargarMisPQRS();

    // DEBUG: Forzar fin de carga
    setTimeout(() => {
      if (this.cargando) {
        this.cargando = false;
        this.errorHttp = "Timeout forzado: La petición HTTP nunca respondió.";
        this.cdr.detectChanges();
      }
    }, 5000);
  }

  cargarMisPQRS() {
    this.cargando = true;
    const uid = this.authService.getIdUsuario();
    this.pqrsService.listar({ usuario_id: uid }).subscribe({
      next: (data) => { 
        this.misPQRS = data; 
        this.cargando = false; 
        this.errorHttp = null; 
        this.cdr.detectChanges();
      },
      error: (err) => { 
        this.cargando = false; 
        this.errorHttp = err.message || err; 
        this.cdr.detectChanges();
      }
    });
  }

  crearPQRS() {
    if (!this.form.tipo || !this.form.asunto.trim() || !this.form.descripcion.trim()) return;
    this.enviando = true;
    this.mensaje = '';

    this.pqrsService.crear({
      usuario_id: this.authService.getIdUsuario(),
      ...this.form
    }).subscribe({
      next: (res) => {
        this.exito = true;
        this.mensaje = `✅ Solicitud enviada. Radicado: ${res.pqrs.radicado}. Revisa tu correo.`;
        this.form = { tipo: '', asunto: '', descripcion: '' };
        this.enviando = false;
        this.cargarMisPQRS();
        setTimeout(() => this.mensaje = '', 8000);
      },
      error: (err) => {
        this.exito = false;
        this.mensaje = err.error?.error || 'Error enviando la solicitud';
        this.enviando = false;
      }
    });
  }

  verDetalle(p: PQRS) {
    this.pqrsService.obtenerDetalle(p._id).subscribe({
      next: (data) => { this.pqrsDetalle = data; }
    });
  }

  cerrarDetalle() { this.pqrsDetalle = null; }

  getEstadoCardClass(estado: string) {
    const map: any = {
      'Pendiente': 'border-amber-200 bg-amber-50/50',
      'En revisión': 'border-blue-200 bg-blue-50/50',
      'Respondida': 'border-emerald-200 bg-emerald-50/50',
      'Cerrada': 'border-slate-200 bg-slate-50/50'
    };
    return map[estado] || 'border-slate-200';
  }

  getTipoClass(tipo: string) {
    const map: any = {
      'Petición': 'bg-blue-100 text-blue-700',
      'Queja': 'bg-red-100 text-red-700',
      'Reclamo': 'bg-orange-100 text-orange-700',
      'Sugerencia': 'bg-violet-100 text-violet-700'
    };
    return map[tipo] || 'bg-slate-100 text-slate-600';
  }

  getEstadoBadgeClass(estado: string) {
    const map: any = {
      'Pendiente': 'bg-amber-100 text-amber-700',
      'En revisión': 'bg-blue-100 text-blue-700',
      'Respondida': 'bg-emerald-100 text-emerald-700',
      'Cerrada': 'bg-slate-100 text-slate-600'
    };
    return map[estado] || 'bg-slate-100 text-slate-600';
  }
}
