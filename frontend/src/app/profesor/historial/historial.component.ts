import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CursoService } from '../../services/curso.service';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-profesor-historial',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './historial.component.html',
  styleUrls: ['./historial.component.scss']
})
export class HistorialComponent implements OnInit {

  historialClases: any[]     = [];
  participacionClase: any[] = [];
  claseSeleccionadaReporte: any | null = null;
  isLoadingHistorial = false;

  constructor(
    private cdr: ChangeDetectorRef,
    private cursoService: CursoService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const profesorId = this.authService.getIdUsuario();
    if (profesorId) {
      this.isLoadingHistorial = true;
      this.cursoService.obtenerHistorialesPorProfesor(profesorId).subscribe({
        next: (data) => {
          this.historialClases = data.map(h => ({
             ...h,
             fechaFormateada: new Date(h.fecha).toLocaleDateString() + ' ' + new Date(h.fecha).toLocaleTimeString(),
             curso: h.curso_id?.nombre || 'Clase Documentada',
             duracion: (h.estadisticas?.palabras || 0) + ' palabras transcritas'
          }));
          this.isLoadingHistorial = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error(err);
          this.isLoadingHistorial = false;
          this.cdr.detectChanges();
        }
      });
    }
  }

  verReporteDetalle(clase: any): void {
    this.claseSeleccionadaReporte = clase;
    this.participacionClase = (clase.participantes || []).map((p: string) => ({
      nombre: p, intervenciones: 'Presente', tiempoHablando: '-'
    }));
  }

  cerrarReporteDetalle(): void {
    this.claseSeleccionadaReporte = null;
    this.participacionClase       = [];
  }
}
