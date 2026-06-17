import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CursoService } from '../../services/curso.service';
import { AuthService } from '../../services/auth';
import { timeout, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import Chart from 'chart.js/auto';
import { AnaliticaService } from '../../services/analitica.service';

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
  isDownloadingPDF = false;

  // Dashboard Analytics
  activeTab: 'historial' | 'dashboard' = 'historial';
  dashboardData: any = null;
  chartDuracion: any;
  chartAsistencia: any;
  chartParticipacion: any;

  constructor(
    private cdr: ChangeDetectorRef,
    private cursoService: CursoService,
    private authService: AuthService,
    private analiticaService: AnaliticaService
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
        this.historialClases = data.map(h => {
          const d = new Date(h.fecha);
          const pad = (n: number) => n.toString().padStart(2, '0');
          return {
            ...h,
            fechaFormateada: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} - ${pad(d.getHours())}:${pad(d.getMinutes())}`,
            curso: h.curso_id?.nombre || 'Clase Documentada',
            duracion: (h.estadisticas?.palabras || 0) + ' palabras'
          };
        });
        this.isLoadingHistorial = false;
        this.cdr.detectChanges();
      });

    this.cargarDashboard();
  }

  cargarDashboard(): void {
    const profesorId = this.authService.getIdUsuario();
    if (!profesorId) return;

    // Dependiendo de si es admin o profesor (en este caso es componente de profesor, pero para robustez usamos el de profesor)
    this.analiticaService.obtenerDashboardProfesor(profesorId).subscribe({
      next: (data) => {
        this.dashboardData = data;
        if (this.activeTab === 'dashboard') {
          setTimeout(() => this.renderizarGraficos(), 100);
        }
      },
      error: (err) => console.error('Error cargando dashboard analytics', err)
    });
  }

  switchTab(tab: 'historial' | 'dashboard'): void {
    this.activeTab = tab;
    this.cdr.detectChanges();
    if (tab === 'dashboard' && this.dashboardData) {
      setTimeout(() => this.renderizarGraficos(), 100);
    }
  }

  renderizarGraficos(): void {
    if (!this.dashboardData) return;

    // Destruir gráficos anteriores si existen
    if (this.chartDuracion) this.chartDuracion.destroy();
    if (this.chartAsistencia) this.chartAsistencia.destroy();
    if (this.chartParticipacion) this.chartParticipacion.destroy();

    const ctxDuracion = document.getElementById('chartDuracion') as HTMLCanvasElement;
    const ctxAsistencia = document.getElementById('chartAsistencia') as HTMLCanvasElement;
    const ctxParticipacion = document.getElementById('chartParticipacion') as HTMLCanvasElement;

    if (ctxDuracion) {
      this.chartDuracion = new Chart(ctxDuracion, {
        type: 'line',
        data: {
          labels: this.dashboardData.labels,
          datasets: [{
            label: 'Duración (min)',
            data: this.dashboardData.duracion,
            borderColor: '#2563EB',
            backgroundColor: 'rgba(37, 99, 235, 0.1)',
            fill: true,
            tension: 0.4
          }]
        },
        options: { responsive: true, plugins: { legend: { position: 'top' } } }
      });
    }

    if (ctxAsistencia) {
      this.chartAsistencia = new Chart(ctxAsistencia, {
        type: 'bar',
        data: {
          labels: this.dashboardData.labels,
          datasets: [
            {
              label: 'Presentes',
              data: this.dashboardData.asistencia.presentes,
              backgroundColor: '#10B981'
            },
            {
              label: 'Ausentes',
              data: this.dashboardData.asistencia.ausentes,
              backgroundColor: '#EF4444'
            }
          ]
        },
        options: { responsive: true, scales: { x: { stacked: true }, y: { stacked: true } } }
      });
    }

    if (ctxParticipacion) {
      this.chartParticipacion = new Chart(ctxParticipacion, {
        type: 'doughnut',
        data: {
          labels: ['Mensajes de Chat', 'Preguntas'],
          datasets: [{
            data: [
              this.dashboardData.participacion.mensajesTotales, 
              this.dashboardData.participacion.preguntasTotales
            ],
            backgroundColor: ['#3B82F6', '#F59E0B']
          }]
        },
        options: { responsive: true }
      });
    }
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

  descargarPDF(): void {
    if (!this.claseSeleccionadaReporte) return;
    const c = this.claseSeleccionadaReporte;
    this.isDownloadingPDF = true;
    const rol = this.authService.obtenerRol() || 'profesor';

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
    this.isLoadingHistorial = true;
    this.errorCarga = false;
    this.historialClases = [];
    this.claseSeleccionadaReporte = null;
    this.participacionClase = [];
    this.cdr.detectChanges();
    this.ngOnInit();
  }
}
