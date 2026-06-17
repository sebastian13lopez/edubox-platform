import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth';
import { CursoService } from '../../services/curso.service';
import { timeout, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-estudiante-historial',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './historial.component.html',
  styleUrls: ['./historial.component.scss']
})
export class HistorialComponent implements OnInit {

  historialClases: any[] = [];
  isLoading = true;
  errorCarga = false;
  claseSeleccionada: any | null = null;
  isDownloadingPDF = false;

  constructor(
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
    private cursoService: CursoService
  ) {}

  ngOnInit(): void {
    const estudianteId = this.authService.getIdUsuario();
    if (!estudianteId) {
      this.isLoading = false;
      this.cdr.detectChanges();
      return;
    }

    this.cursoService.obtenerHistorialesPorEstudiante(estudianteId)
      .pipe(
        timeout(8000),
        catchError(err => {
          console.error('Error al cargar historial del estudiante:', err);
          this.errorCarga = true;
          return of([]);
        })
      )
      .subscribe((data: any[]) => {
        this.historialClases = data.map(h => {
          const d = new Date(h.fecha);
          const pad = (n: number) => n.toString().padStart(2, '0');
          return {
            ...h,
            fechaFormateada: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} - ${pad(d.getHours())}:${pad(d.getMinutes())}`,
            curso: h.curso_id?.nombre || 'Clase registrada',
            profesor: h.profesor_id?.nombre || 'Docente',
            palabras: h.estadisticas?.palabras || 0
          };
        });
        this.isLoading = false;
        this.cdr.detectChanges();
      });
  }

  verDetalle(clase: any): void {
    this.claseSeleccionada = this.claseSeleccionada === clase ? null : clase;
  }

  descargarPDF(): void {
    if (!this.claseSeleccionada) return;
    const c = this.claseSeleccionada;
    this.isDownloadingPDF = true;
    const rol = this.authService.obtenerRol() || 'estudiante';

    this.cursoService.descargarReportePDF(c._id, rol).subscribe({
      next: (blob: Blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `reporte_${c.curso.replace(/\s+/g, '_')}_${new Date(c.fecha).toISOString().slice(0, 10)}.pdf`;
        link.click();
        URL.revokeObjectURL(url);
        this.isDownloadingPDF = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al descargar PDF:', err);
        this.isDownloadingPDF = false;
        this.cdr.detectChanges();
      }
    });
  }

  recargar(): void {
    this.isLoading = true;
    this.errorCarga = false;
    this.historialClases = [];
    this.claseSeleccionada = null;
    this.cdr.detectChanges();
    this.ngOnInit();
  }
}
