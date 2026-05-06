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
        this.historialClases = data.map(h => ({
          ...h,
          fechaFormateada: new Date(h.fecha).toLocaleDateString('es', {
            year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
          }),
          curso: h.curso_id?.nombre || 'Clase registrada',
          profesor: h.profesor_id?.nombre || 'Docente',
          palabras: h.estadisticas?.palabras || 0
        }));
        this.isLoading = false;
        this.cdr.detectChanges();
      });
  }

  verDetalle(clase: any): void {
    this.claseSeleccionada = this.claseSeleccionada === clase ? null : clase;
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
