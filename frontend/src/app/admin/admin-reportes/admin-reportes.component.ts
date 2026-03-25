import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CursoService } from '../../services/curso.service';

@Component({
  selector: 'app-admin-reportes',
  standalone: true,
  imports: [CommonModule],
  template: `
<div class="space-y-6">
  <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
    <div>
      <h2 class="text-2xl font-extrabold text-[#111827] tracking-tight">Reportes del Sistema</h2>
      <p class="text-slate-500 text-sm font-medium mt-1">Historial global de todas las transcripciones generadas por la inteligencia artificial.</p>
    </div>
    <div class="bg-indigo-50 text-indigo-700 text-sm font-black px-4 py-2 rounded-xl mt-4 sm:mt-0 shadow-sm flex items-center gap-2">
      <svg class="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path></svg>
      {{ reportes.length }} Clases Almacenadas
    </div>
  </div>

  <div *ngIf="isLoading" class="flex justify-center py-20">
    <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
  </div>

  <div *ngIf="!isLoading && reportes.length === 0" class="bg-white rounded-3xl p-16 text-center border border-slate-200 flex flex-col items-center">
    <div class="w-20 h-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-6">
      <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
    </div>
    <h3 class="text-xl font-extrabold text-[#111827]">Sin histórico</h3>
    <p class="text-slate-500 text-sm mt-2">Ningún docente ha emitido y guardado una clase aún.</p>
  </div>

  <div *ngIf="!isLoading && reportes.length > 0" class="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-400 font-black border-b border-slate-200">
            <th class="px-6 py-4">Fecha</th>
            <th class="px-6 py-4">Docente</th>
            <th class="px-6 py-4">Materia</th>
            <th class="px-6 py-4">Estadísticas</th>
            <th class="px-6 py-4 text-right">Transcripción</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr *ngFor="let rep of reportes" class="hover:bg-slate-50 transition-colors group">
            <td class="px-6 py-4 text-sm font-bold text-slate-800">{{ rep.fechaFormateada }}</td>
            <td class="px-6 py-4">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">{{ rep.profesor_id?.nombre?.charAt(0) || 'D' }}</div>
                <span class="text-sm font-medium text-slate-700">{{ rep.profesor_id?.nombre || 'Docente Rescindido' }}</span>
              </div>
            </td>
            <td class="px-6 py-4 text-sm font-bold text-slate-600">{{ rep.curso_id?.nombre || 'Curso Eliminado' }}</td>
            <td class="px-6 py-4">
              <span class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
                 {{ rep.estadisticas?.palabras || 0 }} palabras
              </span>
            </td>
            <td class="px-6 py-4 text-right">
              <button class="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-600 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-indigo-100 outline-none" (click)="verTexto(rep)">Ver Resumen</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Modal Simple -->
  <div *ngIf="selectedRep" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
    <div class="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-fade-in-up">
      <div class="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
        <div>
          <h3 class="text-lg font-extrabold text-slate-800">Transcripción Oficial</h3>
          <p class="text-xs font-black text-slate-400 uppercase tracking-widest mt-1">{{ selectedRep.curso_id?.nombre }} - {{ selectedRep.fechaFormateada }}</p>
        </div>
        <button (click)="selectedRep = null" class="p-2 bg-white rounded-xl border border-slate-200 text-slate-500 hover:text-rose-500 hover:bg-rose-50 transition-all">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>
      <div class="p-8 max-h-[60vh] overflow-y-auto text-slate-700 text-sm font-medium leading-relaxed bg-[#F8FAFC]">
         {{ selectedRep.textoCompleto || 'Sin contenido audible registrado.' }}
      </div>
    </div>
  </div>
</div>
  `
})
export class AdminReportesComponent implements OnInit {
  reportes: any[] = [];
  isLoading = false;
  selectedRep: any = null;

  constructor(private cursoService: CursoService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.isLoading = true;
    this.cursoService.obtenerTodosLosHistoriales().subscribe({
      next: (data) => {
        this.reportes = data.map(r => ({
          ...r,
          fechaFormateada: new Date(r.fecha).toLocaleDateString() + ' ' + new Date(r.fecha).toLocaleTimeString()
        }));
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (e) => {
        console.error(e);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  verTexto(rep: any) {
    this.selectedRep = rep;
  }
}
