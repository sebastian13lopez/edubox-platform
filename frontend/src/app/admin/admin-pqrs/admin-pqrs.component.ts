import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PqrsService, PQRS } from '../../services/pqrs.service';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-admin-pqrs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="min-h-screen bg-slate-50 p-6">
  <div class="max-w-5xl mx-auto">

    <!-- Encabezado -->
    <div class="flex items-start justify-between mb-8">
      <div>
        <h1 class="text-3xl font-extrabold text-slate-800">Gestión de PQRS</h1>
        <p class="text-slate-500 mt-1">Peticiones, Quejas, Reclamos y Sugerencias del sistema</p>
      </div>
    </div>

    <!-- Stats cards -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8" *ngIf="stats">
      <div class="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
        <p class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total</p>
        <p class="text-3xl font-black text-slate-800">{{ stats.totalGeneral }}</p>
      </div>
      <div *ngFor="let s of stats.porEstado" class="bg-white rounded-2xl p-5 border shadow-sm"
        [ngClass]="getEstadoBorderClass(s._id)">
        <p class="text-xs font-bold uppercase tracking-widest mb-1" [ngClass]="getEstadoTextClass(s._id)">{{ s._id }}</p>
        <p class="text-3xl font-black text-slate-800">{{ s.total }}</p>
      </div>
    </div>

    <!-- Filtros -->
    <div class="bg-white rounded-2xl border border-slate-100 p-4 mb-6 flex flex-wrap gap-3 items-center">
      <span class="text-sm font-bold text-slate-500">Filtrar:</span>
      <button *ngFor="let e of estados" (click)="filtroEstado = (filtroEstado === e ? '' : e); filtrar()"
        class="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
        [ngClass]="filtroEstado === e ? getEstadoBadgeActiveClass(e) : 'bg-slate-100 text-slate-500 hover:bg-slate-200'">
        {{ e }}
      </button>
      <div class="flex-1 min-w-[180px]">
        <input [(ngModel)]="buscar" (input)="filtrar()" placeholder="Buscar..." type="text"
          class="w-full px-3 py-1.5 bg-slate-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-400 text-slate-700">
      </div>
    </div>

    <!-- Tabla de PQRS -->
    <div class="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
      <div *ngIf="cargando" class="flex justify-center py-16">
        <div class="w-8 h-8 border-2 border-violet-200 border-t-violet-600 rounded-full animate-spin"></div>
      </div>

      <div *ngIf="!cargando && pqrsList.length === 0 && !errorHttp" class="text-center py-16">
        <p class="text-slate-400 font-medium">No hay PQRS con los filtros aplicados.</p>
      </div>

      <div *ngIf="errorHttp" class="text-center py-16 bg-red-50 text-red-600 font-bold">
        Error HTTP: {{ errorHttp | json }}
      </div>

      <table *ngIf="!cargando && pqrsList.length > 0 && !errorHttp" class="w-full">
        <thead class="bg-slate-50 border-b border-slate-100">
          <tr>
            <th class="text-left text-xs font-bold text-slate-400 uppercase tracking-widest px-6 py-4">Radicado</th>
            <th class="text-left text-xs font-bold text-slate-400 uppercase tracking-widest px-4 py-4">Usuario</th>
            <th class="text-left text-xs font-bold text-slate-400 uppercase tracking-widest px-4 py-4">Tipo</th>
            <th class="text-left text-xs font-bold text-slate-400 uppercase tracking-widest px-4 py-4">Asunto</th>
            <th class="text-left text-xs font-bold text-slate-400 uppercase tracking-widest px-4 py-4">Estado</th>
            <th class="text-left text-xs font-bold text-slate-400 uppercase tracking-widest px-4 py-4">Fecha</th>
            <th class="px-4 py-4"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-50">
          <tr *ngFor="let p of pqrsList" class="hover:bg-slate-50/60 transition-colors">
            <td class="px-6 py-4 font-mono text-xs text-violet-600 font-bold">{{ p.radicado }}</td>
            <td class="px-4 py-4">
              <p class="text-sm font-semibold text-slate-800">{{ p.usuario_id?.nombre }}</p>
              <p class="text-xs text-slate-400">{{ p.usuario_id?.email }}</p>
            </td>
            <td class="px-4 py-4">
              <span class="text-xs font-bold px-2.5 py-1 rounded-full" [ngClass]="getTipoClass(p.tipo)">{{ p.tipo }}</span>
            </td>
            <td class="px-4 py-4 text-sm text-slate-700 max-w-[200px] truncate">{{ p.asunto }}</td>
            <td class="px-4 py-4">
              <span class="text-xs font-bold px-2.5 py-1 rounded-full" [ngClass]="getEstadoBadgeClass(p.estado)">{{ p.estado }}</span>
            </td>
            <td class="px-4 py-4 text-xs text-slate-400">{{ p.createdAt | date:'d MMM yyyy' }}</td>
            <td class="px-4 py-4">
              <button (click)="abrirResponder(p)"
                class="px-3 py-1.5 text-xs font-bold rounded-xl transition-all"
                [ngClass]="p.estado === 'Respondida' || p.estado === 'Cerrada'
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-violet-100 text-violet-700 hover:bg-violet-200'">
                {{ p.estado === 'Respondida' ? 'Respondida' : 'Responder' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

  </div>
</div>

<!-- ── MODAL RESPONDER ── -->
<div *ngIf="pqrsAResponder" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
  (click)="cerrarModal()">
  <div class="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-8 max-h-[90vh] overflow-y-auto" (click)="$event.stopPropagation()">

    <div class="flex items-start justify-between mb-6">
      <div>
        <h3 class="text-xl font-extrabold text-slate-800">Responder PQRS</h3>
        <p class="font-mono text-sm text-violet-600 mt-0.5">{{ pqrsAResponder.radicado }}</p>
      </div>
      <button (click)="cerrarModal()" class="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>

    <!-- Info de la PQRS -->
    <div class="bg-slate-50 rounded-2xl p-4 mb-5 space-y-2">
      <div class="flex gap-2">
        <span class="text-xs font-bold text-slate-400 w-24">Usuario:</span>
        <span class="text-sm font-semibold text-slate-700">{{ pqrsAResponder.usuario_id?.nombre }} — {{ pqrsAResponder.usuario_id?.email }}</span>
      </div>
      <div class="flex gap-2">
        <span class="text-xs font-bold text-slate-400 w-24">Tipo:</span>
        <span class="text-xs font-bold px-2 py-0.5 rounded-full" [ngClass]="getTipoClass(pqrsAResponder.tipo)">{{ pqrsAResponder.tipo }}</span>
      </div>
      <div class="flex gap-2">
        <span class="text-xs font-bold text-slate-400 w-24">Asunto:</span>
        <span class="text-sm text-slate-700 font-medium">{{ pqrsAResponder.asunto }}</span>
      </div>
    </div>

    <!-- Descripción -->
    <div class="bg-slate-50 rounded-2xl p-4 mb-5">
      <p class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Solicitud del usuario</p>
      <p class="text-sm text-slate-700 leading-relaxed">{{ pqrsAResponder.descripcion }}</p>
    </div>

    <!-- Cambiar estado -->
    <div class="mb-4">
      <label class="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Estado</label>
      <select [(ngModel)]="estadoSeleccionado"
        class="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-violet-400">
        <option value="En revisión">En revisión</option>
        <option value="Respondida">Respondida</option>
        <option value="Cerrada">Cerrada</option>
      </select>
    </div>

    <!-- Respuesta -->
    <div class="mb-5">
      <label class="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Tu respuesta oficial</label>
      <textarea [(ngModel)]="respuestaTexto" rows="5" required
        placeholder="Escribe la respuesta oficial. Esta se incluirá en el PDF enviado al usuario por correo..."
        class="w-full px-4 py-3 bg-slate-50 rounded-2xl border border-slate-200 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-violet-400 resize-none"></textarea>
    </div>

    <!-- Info correo -->
    <div class="bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 text-xs text-violet-700 font-medium mb-5 flex items-center gap-2">
      <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
      </svg>
      Al confirmar, se generará un PDF y se enviará automáticamente al correo del usuario.
    </div>

    <!-- Botones -->
    <div class="flex gap-3">
      <button (click)="cerrarModal()" class="flex-1 py-3 rounded-2xl border-2 border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all">
        Cancelar
      </button>
      <button (click)="enviarRespuesta()" [disabled]="respondiendo || !respuestaTexto.trim()"
        class="flex-1 py-3 rounded-2xl bg-violet-600 text-white font-bold hover:bg-violet-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
        <span *ngIf="respondiendo" class="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></span>
        {{ respondiendo ? 'Enviando...' : '📨 Enviar y generar PDF' }}
      </button>
    </div>

    <!-- Feedback -->
    <div *ngIf="mensajeModal" class="mt-4 rounded-xl px-4 py-3 text-sm font-semibold"
      [ngClass]="exitoModal ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'">
      {{ mensajeModal }}
    </div>
  </div>
</div>
  `
})
export class AdminPqrsComponent implements OnInit {
  pqrsList: PQRS[] = [];
  cargando = true;
  stats: any = null;

  filtroEstado = '';
  buscar = '';
  estados = ['Pendiente', 'En revisión', 'Respondida', 'Cerrada'];

  pqrsAResponder: PQRS | null = null;
  respuestaTexto = '';
  estadoSeleccionado = 'Respondida';
  respondiendo = false;
  mensajeModal = '';
  exitoModal = false;
  errorHttp: any = null;

  constructor(
    private pqrsService: PqrsService, 
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.cargarPQRS();
    this.cargarStats();

    // DEBUG: Forzar fin de carga después de 5 segundos
    setTimeout(() => {
      if (this.cargando) {
        this.cargando = false;
        this.errorHttp = "Timeout forzado: La petición HTTP nunca respondió.";
        this.pqrsList = [];
        this.cdr.detectChanges();
      }
    }, 5000);
  }

  cargarPQRS() {
    this.cargando = true;
    const params: any = {};
    if (this.filtroEstado) params['estado'] = this.filtroEstado;
    if (this.buscar.trim()) params['buscar'] = this.buscar.trim();

    this.pqrsService.listar(params).subscribe({
      next: (data) => { 
        this.pqrsList = data; 
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

  cargarStats() {
    this.pqrsService.stats().subscribe({ 
      next: (s) => {
        this.stats = s;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorHttp = err.message || err;
        this.cdr.detectChanges();
      }
    });
  }

  filtrar() { this.cargarPQRS(); }

  abrirResponder(p: PQRS) {
    if (p.estado === 'Respondida' || p.estado === 'Cerrada') return;
    this.pqrsAResponder = p;
    this.respuestaTexto = '';
    this.estadoSeleccionado = 'Respondida';
    this.mensajeModal = '';
  }

  cerrarModal() {
    this.pqrsAResponder = null;
    this.mensajeModal = '';
  }

  enviarRespuesta() {
    if (!this.pqrsAResponder || !this.respuestaTexto.trim()) return;
    this.respondiendo = true;
    this.mensajeModal = '';

    this.pqrsService.responder(
      this.pqrsAResponder._id,
      this.authService.getIdUsuario(),
      this.respuestaTexto
    ).subscribe({
      next: () => {
        this.exitoModal = true;
        this.mensajeModal = '✅ Respuesta enviada. El PDF fue enviado al correo del usuario.';
        this.respondiendo = false;
        setTimeout(() => {
          this.cerrarModal();
          this.cargarPQRS();
          this.cargarStats();
        }, 2500);
      },
      error: (err) => {
        this.exitoModal = false;
        this.mensajeModal = err.error?.error || 'Error enviando la respuesta';
        this.respondiendo = false;
      }
    });
  }

  getEstadoBorderClass(e: string) {
    const m: any = { 'Pendiente': 'border-amber-200', 'En revisión': 'border-blue-200', 'Respondida': 'border-emerald-200', 'Cerrada': 'border-slate-200' };
    return m[e] || 'border-slate-100';
  }

  getEstadoTextClass(e: string) {
    const m: any = { 'Pendiente': 'text-amber-500', 'En revisión': 'text-blue-500', 'Respondida': 'text-emerald-600', 'Cerrada': 'text-slate-400' };
    return m[e] || 'text-slate-400';
  }

  getEstadoBadgeClass(e: string) {
    const m: any = { 'Pendiente': 'bg-amber-100 text-amber-700', 'En revisión': 'bg-blue-100 text-blue-700', 'Respondida': 'bg-emerald-100 text-emerald-700', 'Cerrada': 'bg-slate-100 text-slate-500' };
    return m[e] || 'bg-slate-100 text-slate-500';
  }

  getEstadoBadgeActiveClass(e: string) {
    const m: any = { 'Pendiente': 'bg-amber-500 text-white', 'En revisión': 'bg-blue-500 text-white', 'Respondida': 'bg-emerald-500 text-white', 'Cerrada': 'bg-slate-500 text-white' };
    return m[e] || 'bg-slate-500 text-white';
  }

  getTipoClass(t: string) {
    const m: any = { 'Petición': 'bg-blue-100 text-blue-700', 'Queja': 'bg-red-100 text-red-700', 'Reclamo': 'bg-orange-100 text-orange-700', 'Sugerencia': 'bg-violet-100 text-violet-700' };
    return m[t] || 'bg-slate-100 text-slate-600';
  }
}
