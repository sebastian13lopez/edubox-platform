import { environment } from '@env/environment';
import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth';
import { CursoService } from '../../services/curso.service';
import { Chart, registerables } from 'chart.js';

// Registrar todos los módulos de Chart.js
Chart.register(...registerables);

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent implements OnInit, AfterViewInit, OnDestroy {

  // Referencias a los canvas de las gráficas
  @ViewChild('chartSexo') chartSexoRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartTimeline') chartTimelineRef!: ElementRef<HTMLCanvasElement>;

  // Instancias de Chart.js para poder destruirlas
  private chartSexo: Chart | null = null;
  private chartTimeline: Chart | null = null;

  // Datos del dashboard
  profesoresPendientesCount: number = 0;
  solicitudesPendientes: any[] = [];

  // Datos de los cursos
  cursos: any[] = [];
  profesores: any[] = [];
  estudiantes: any[] = [];

  // Datos de gráficas
  statsPorSexo: any = null;
  statsActividadDia: number[] = [];

  // Flag para saber si las vistas están listas
  private viewReady = false;
  private dataReadySexo = false;
  private dataReadyTimeline = false;

  cursoForm: FormGroup;

  constructor(
    private router: Router,
    private http: HttpClient,
    private authService: AuthService,
    private cursoService: CursoService,
    private fb: FormBuilder
  ) {
    this.cursoForm = this.fb.group({
      nombre: ['', Validators.required],
      descripcion: [''],
      profesor_id: ['', Validators.required],
      estudiantes_ids: [[]]
    });
  }

  ngOnInit() {
    this.cargarSolicitudes();
    this.cargarCursos();
    this.cargarUsuarios();
    this.cargarStatsPorSexo();
    this.cargarStatsActividadDia();
  }

  ngAfterViewInit() {
    this.viewReady = true;
    // Si los datos ya llegaron antes de que la vista estuviera lista, renderizar
    if (this.dataReadySexo) this.renderizarGraficaSexo();
    if (this.dataReadyTimeline) this.renderizarGraficaTimeline();
  }

  ngOnDestroy() {
    // Destruir instancias para evitar memory leaks
    this.chartSexo?.destroy();
    this.chartTimeline?.destroy();
  }

  // ── Carga de datos ──────────────────────────────────────────

  cargarSolicitudes() {
    this.http.get(environment.apiUrl + '/usuarios/pendientes').subscribe({
      next: (res: any) => {
        this.solicitudesPendientes = res;
        this.profesoresPendientesCount = this.solicitudesPendientes.length;
      },
      error: (err) => console.error('Error al cargar solicitudes', err)
    });
  }

  cargarCursos() {
    this.cursoService.obtenerTodosLosCursos().subscribe({
      next: (data) => this.cursos = data,
      error: (err) => console.error('Error cargando cursos', err)
    });
  }

  cargarUsuarios() {
    this.http.get<any[]>(environment.apiUrl + '/usuarios').subscribe({
      next: (usuarios) => {
        this.profesores = usuarios.filter(u => u.rol === 'profesor');
        this.estudiantes = usuarios.filter(u => u.rol === 'estudiante');
      },
      error: (err) => console.error('Error cargando usuarios', err)
    });
  }

  cargarStatsPorSexo() {
    this.http.get<any>(environment.apiUrl + '/usuarios/stats/por-sexo').subscribe({
      next: (data) => {
        this.statsPorSexo = data;
        this.dataReadySexo = true;
        if (this.viewReady) this.renderizarGraficaSexo();
      },
      error: (err) => {
        console.error('Error cargando stats por sexo', err);
        // Datos de respaldo en caso de error
        this.statsPorSexo = { Masculino: 0, Femenino: 0, Otro: 0, 'Sin especificar': 0 };
        this.dataReadySexo = true;
        if (this.viewReady) this.renderizarGraficaSexo();
      }
    });
  }

  cargarStatsActividadDia() {
    this.http.get<number[]>(environment.apiUrl + '/usuarios/stats/actividad-dia').subscribe({
      next: (data) => {
        this.statsActividadDia = data;
        this.dataReadyTimeline = true;
        if (this.viewReady) this.renderizarGraficaTimeline();
      },
      error: (err) => {
        console.error('Error cargando stats de actividad', err);
        this.statsActividadDia = Array(24).fill(0);
        this.dataReadyTimeline = true;
        if (this.viewReady) this.renderizarGraficaTimeline();
      }
    });
  }

  // ── Renderizado de gráficas ─────────────────────────────────

  renderizarGraficaSexo() {
    if (!this.chartSexoRef || !this.statsPorSexo) return;

    this.chartSexo?.destroy();

    const ctx = this.chartSexoRef.nativeElement.getContext('2d');
    if (!ctx) return;

    const labels = ['Masculino', 'Femenino', 'Otro', 'Prefiero no decir', 'Sin especificar'];
    const valores = labels.map(l => this.statsPorSexo[l] ?? 0);
    const total = valores.reduce((a, b) => a + b, 0);

    this.chartSexo = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: valores,
          backgroundColor: [
            'rgba(99, 102, 241, 0.85)',   // indigo  - Masculino
            'rgba(236, 72, 153, 0.85)',   // pink    - Femenino
            'rgba(16, 185, 129, 0.85)',   // emerald - Otro
            'rgba(245, 158, 11, 0.85)',   // amber   - Prefiero no decir
            'rgba(148, 163, 184, 0.85)'  // slate   - Sin especificar
          ],
          borderColor: [
            'rgba(99, 102, 241, 1)',
            'rgba(236, 72, 153, 1)',
            'rgba(16, 185, 129, 1)',
            'rgba(245, 158, 11, 1)',
            'rgba(148, 163, 184, 1)'
          ],
          borderWidth: 2,
          hoverOffset: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 16,
              font: { size: 12, weight: 'bold', family: 'Inter, sans-serif' },
              color: '#475569',
              usePointStyle: true,
              pointStyleWidth: 10
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const val = context.raw as number;
                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
                return ` ${val} estudiantes (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }

  renderizarGraficaTimeline() {
    if (!this.chartTimelineRef) return;

    this.chartTimeline?.destroy();

    const ctx = this.chartTimelineRef.nativeElement.getContext('2d');
    if (!ctx) return;

    // Etiquetas de 0:00 a 23:00
    const horas = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

    // Gradiente para el área bajo la curva
    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.35)');
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0.02)');

    this.chartTimeline = new Chart(ctx, {
      type: 'line',
      data: {
        labels: horas,
        datasets: [{
          label: 'Estudiantes activos',
          data: this.statsActividadDia,
          borderColor: 'rgba(99, 102, 241, 1)',
          borderWidth: 2.5,
          backgroundColor: gradient,
          fill: true,
          tension: 0.45,
          pointBackgroundColor: 'rgba(99, 102, 241, 1)',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 7
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1e293b',
            titleColor: '#94a3b8',
            bodyColor: '#f1f5f9',
            padding: 12,
            borderColor: 'rgba(99,102,241,0.3)',
            borderWidth: 1,
            callbacks: {
              title: (items) => `🕐 ${items[0].label}`,
              label: (context) => `  ${context.raw} estudiante(s) activo(s)`
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(148, 163, 184, 0.08)', drawTicks: false },
            border: { display: false },
            ticks: {
              color: '#94a3b8',
              font: { size: 10, family: 'Inter, sans-serif' },
              maxRotation: 45,
              autoSkip: true,
              maxTicksLimit: 12
            }
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(148, 163, 184, 0.1)', drawTicks: false },
            border: { display: false },
            ticks: {
              color: '#94a3b8',
              font: { size: 11, family: 'Inter, sans-serif' },
              precision: 0,
              stepSize: 1
            }
          }
        }
      }
    });
  }

  // ── Acciones ────────────────────────────────────────────────

  guardarCurso() {
    if (this.cursoForm.valid) {
      this.cursoService.crearCurso(this.cursoForm.value).subscribe({
        next: () => {
          this.cursoForm.reset();
          this.cargarCursos();
          alert('¡Curso creado exitosamente!');
        },
        error: (err) => {
          console.error('Error al crear curso', err);
          alert('Hubo un error al crear el curso');
        }
      });
    } else {
      alert('Por favor, completa los campos requeridos (Nombre y Profesor)');
    }
  }

  aprobarProfesor(id: number) { console.log('Aprobando', id); }
  rechazarProfesor(id: number) { console.log('Rechazando', id); }

  cerrarSesion() {
    this.authService.cerrarSesionLocal();
    this.router.navigate(['/login']);
  }
}
