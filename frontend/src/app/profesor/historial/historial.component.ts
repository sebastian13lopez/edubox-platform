import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CursoService } from '../../services/curso.service';
import { AuthService } from '../../services/auth';
import { timeout, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-profesor-historial',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './historial.component.html',
  styleUrls: ['./historial.component.scss']
})
export class HistorialComponent implements OnInit {

  historialClases: any[]    = [];
  participacionClase: any[] = [];
  claseSeleccionadaReporte: any | null = null;
  isLoadingHistorial = true;
  errorCarga = false;

  constructor(
    private cdr: ChangeDetectorRef,
    private cursoService: CursoService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const profesorId = this.authService.getIdUsuario();
    if (!profesorId) {
      this.isLoadingHistorial = false;
      this.cdr.detectChanges();
      return;
    }

    this.cursoService.obtenerHistorialesPorProfesor(profesorId)
      .pipe(
        timeout(8000),
        catchError(err => {
          console.error('Error al cargar historial:', err);
          this.errorCarga = true;
          return of([]);
        })
      )
      .subscribe((data: any[]) => {
        this.historialClases = data.map(h => ({
          ...h,
          fechaFormateada: new Date(h.fecha).toLocaleDateString('es', {
            year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
          }),
          curso: h.curso_id?.nombre || 'Clase Documentada',
          duracion: (h.estadisticas?.palabras || 0) + ' palabras transcritas'
        }));
        this.isLoadingHistorial = false;
        this.cdr.detectChanges();
      });
  }

  verReporteDetalle(clase: any): void {
    this.claseSeleccionadaReporte = clase;
    this.participacionClase = (clase.participantes || []).map((p: string) => ({
      nombre: p,
      intervenciones: 'Presente',
      tiempoHablando: '—'
    }));
  }

  cerrarReporteDetalle(): void {
    this.claseSeleccionadaReporte = null;
    this.participacionClase       = [];
  }

  exportarCSV(): void {
    if (!this.claseSeleccionadaReporte) return;
    const c = this.claseSeleccionadaReporte;

    const filas: any[][] = [
      ['Reporte de Clase - EduVox'],
      ['Curso', c.curso],
      ['Fecha', c.fechaFormateada],
      ['Palabras transcritas', c.estadisticas?.palabras || 0],
      [''],
      ['Alumno', 'Estado'],
      ...(c.participantes || []).map((p: string) => [p, 'Presente']),
      [''],
      ['Transcripción'],
      [c.textoCompleto || 'Sin texto registrado']
    ];

    const csvContent = filas
      .map(f => f.map((v: any) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reporte_${c.curso.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  recargar(): void {
    this.isLoadingHistorial = true;
    this.errorCarga = false;
    this.historialClases = [];
    this.claseSeleccionadaReporte = null;
    this.participacionClase = [];
    this.cdr.detectChanges();
    this.ngOnInit();
  }
}
