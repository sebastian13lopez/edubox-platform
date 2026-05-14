import {
  Component, OnInit, AfterViewInit, OnDestroy,
  ViewChild, ElementRef, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

const API = 'http://localhost:3000/api/usuarios';

const SEXO_LABELS  = ['Masculino', 'Femenino', 'Otro', 'Prefiero no decir', 'Sin especificar'];
const SEXO_COLORS  = [
  { bg: 'rgba(99,102,241,0.85)',  border: 'rgba(99,102,241,1)'  },
  { bg: 'rgba(236,72,153,0.85)', border: 'rgba(236,72,153,1)'  },
  { bg: 'rgba(16,185,129,0.85)', border: 'rgba(16,185,129,1)'  },
  { bg: 'rgba(245,158,11,0.85)', border: 'rgba(245,158,11,1)'  },
  { bg: 'rgba(148,163,184,0.85)',border: 'rgba(148,163,184,1)' },
];

@Component({
  selector: 'app-admin-estudiantes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-estudiantes.component.html',
  styles: []
})
export class AdminEstudiantesComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('chartSexo')     chartSexoRef!:     ElementRef<HTMLCanvasElement>;
  @ViewChild('chartTimeline') chartTimelineRef!: ElementRef<HTMLCanvasElement>;

  private chartSexo:     Chart | null = null;
  private chartTimeline: Chart | null = null;
  private viewReady = false;

  estudiantes: any[] = [];
  cargando           = true;
  busqueda           = '';

  mostrarModal      = false;
  estudianteEditar: any = null;
  sexoSeleccionado  = '';
  guardandoSexo     = false;

  readonly sexoLabels = SEXO_LABELS;

  // ── Stats calculadas desde el array local ─────────────────
  get statsSexo(): Record<string, number> {
    const mapa: Record<string, number> = {};
    SEXO_LABELS.forEach(l => (mapa[l] = 0));
    this.estudiantes.forEach(e => {
      const k = e.sexo || 'Sin especificar';
      mapa[k] = (mapa[k] ?? 0) + 1;
    });
    return mapa;
  }

  get statsTimeline(): { labels: string[]; daily: number[]; cumulative: number[] } {
    const now   = new Date();
    const labels: string[] = [];
    const daily:  number[] = [];

    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dayStr = d.toISOString().split('T')[0];
      labels.push(d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }));
      daily.push(
        this.estudiantes.filter(e =>
          e.createdAt && new Date(e.createdAt).toISOString().split('T')[0] === dayStr
        ).length
      );
    }

    let acc = 0;
    const cumulative = daily.map(v => (acc += v));
    return { labels, daily, cumulative };
  }

  get totalSinSexo()  { return this.statsSexo['Sin especificar'] ?? 0; }
  get totalMasculino(){ return this.statsSexo['Masculino'] ?? 0; }
  get totalFemenino() { return this.statsSexo['Femenino'] ?? 0; }
  get totalOtros()    { return (this.statsSexo['Otro'] ?? 0) + (this.statsSexo['Prefiero no decir'] ?? 0); }

  get estudiantesFiltrados() {
    const q = this.busqueda.trim().toLowerCase();
    if (!q) return this.estudiantes;
    return this.estudiantes.filter(e =>
      e.nombre?.toLowerCase().includes(q) || e.email?.toLowerCase().includes(q)
    );
  }

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit()  { this.cargarEstudiantes(); }

  ngAfterViewInit() {
    this.viewReady = true;
    if (!this.cargando) this.renderCharts();
  }

  ngOnDestroy() {
    this.chartSexo?.destroy();
    this.chartTimeline?.destroy();
  }

  // ── Carga ─────────────────────────────────────────────────
  cargarEstudiantes() {
    this.cargando = true;
    this.http.get<any[]>(API).subscribe({
      next: res => {
        this.estudiantes = res.filter(u => u.rol === 'estudiante');
        this.cargando = false;
        this.cdr.detectChanges();
        if (this.viewReady) this.renderCharts();
      },
      error: () => { this.cargando = false; this.cdr.detectChanges(); }
    });
  }

  renderCharts() { setTimeout(() => { this.renderSexo(); this.renderTimeline(); }, 0); }

  // ── Gráfica Donut (sexo) ──────────────────────────────────
  renderSexo() {
    if (!this.chartSexoRef) return;
    this.chartSexo?.destroy();
    const ctx = this.chartSexoRef.nativeElement.getContext('2d');
    if (!ctx) return;

    const valores = SEXO_LABELS.map(l => this.statsSexo[l] ?? 0);
    const total   = valores.reduce((a, b) => a + b, 0);

    const centerPlugin: any = {
      id: 'centerText',
      afterDraw: (chart: any) => {
        const { ctx: c, chartArea } = chart;
        const cx = (chartArea.left + chartArea.right) / 2;
        const cy = (chartArea.top + chartArea.bottom)  / 2;
        c.save();
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.font = 'bold 30px Inter, sans-serif'; c.fillStyle = '#111827';
        c.fillText(String(total), cx, cy - 11);
        c.font = '500 11px Inter, sans-serif'; c.fillStyle = '#94a3b8';
        c.fillText('estudiantes', cx, cy + 13);
        c.restore();
      }
    };

    this.chartSexo = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: SEXO_LABELS,
        datasets: [{ data: valores, backgroundColor: SEXO_COLORS.map(c => c.bg),
          borderColor: SEXO_COLORS.map(c => c.border), borderWidth: 2, hoverOffset: 10 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '68%',
        animation: { animateRotate: true, animateScale: true, duration: 800 },
        plugins: {
          legend: {
            position: 'bottom',
            labels: { padding: 12, font: { size: 11, weight: 'bold', family: 'Inter, sans-serif' },
              color: '#475569', usePointStyle: true, pointStyleWidth: 8,
              filter: (item: any, data: any) => (data.datasets[0].data[item.index] as number) > 0
            }
          },
          tooltip: {
            backgroundColor: '#1e293b', titleColor: '#94a3b8', bodyColor: '#f1f5f9',
            padding: 10, borderColor: 'rgba(99,102,241,0.3)', borderWidth: 1,
            callbacks: {
              label: (ctx: any) => {
                const val = ctx.raw as number;
                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
                return `  ${val} estudiante(s) — ${pct}%`;
              }
            }
          }
        }
      },
      plugins: [centerPlugin]
    });
  }

  // ── Gráfica Combo: barras diarias + línea acumulada ───────
  renderTimeline() {
    if (!this.chartTimelineRef) return;
    this.chartTimeline?.destroy();
    const ctx = this.chartTimelineRef.nativeElement.getContext('2d');
    if (!ctx) return;

    const { labels, daily, cumulative } = this.statsTimeline;
    const gradient = ctx.createLinearGradient(0, 0, 0, 230);
    gradient.addColorStop(0, 'rgba(99,102,241,0.35)');
    gradient.addColorStop(1, 'rgba(99,102,241,0.02)');

    this.chartTimeline = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            type: 'bar' as const,
            label: 'Registros del día',
            data: daily,
            backgroundColor: 'rgba(99,102,241,0.25)',
            borderColor:      'rgba(99,102,241,0.7)',
            borderWidth: 1,
            borderRadius: 5,
            order: 2,
            yAxisID: 'y'
          },
          {
            type: 'line' as const,
            label: 'Total acumulado',
            data: cumulative,
            borderColor: 'rgba(99,102,241,1)',
            borderWidth: 2.5,
            backgroundColor: gradient,
            fill: true, tension: 0.45,
            pointBackgroundColor: 'rgba(99,102,241,1)',
            pointBorderColor: '#ffffff', pointBorderWidth: 2,
            pointRadius: 3, pointHoverRadius: 6,
            order: 1,
            yAxisID: 'y'
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 800 },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: true, position: 'top', align: 'end',
            labels: { padding: 12, font: { size: 11, weight: 'bold', family: 'Inter, sans-serif' },
              color: '#64748b', usePointStyle: true, pointStyleWidth: 8 }
          },
          tooltip: {
            backgroundColor: '#1e293b', titleColor: '#94a3b8', bodyColor: '#f1f5f9',
            padding: 12, borderColor: 'rgba(99,102,241,0.3)', borderWidth: 1
          }
        },
        scales: {
          x: { grid: { color: 'rgba(148,163,184,0.07)', drawTicks: false }, border: { display: false },
            ticks: { color: '#94a3b8', font: { size: 10, family: 'Inter, sans-serif' },
              maxRotation: 45, autoSkip: true, maxTicksLimit: 10 } },
          y: { beginAtZero: true, grid: { color: 'rgba(148,163,184,0.1)', drawTicks: false },
            border: { display: false },
            ticks: { color: '#94a3b8', font: { size: 11, family: 'Inter, sans-serif' }, precision: 0 } }
        }
      }
    });
  }

  // ── Modal edición de sexo ─────────────────────────────────
  abrirModalSexo(est: any) {
    this.estudianteEditar = est; this.sexoSeleccionado = est.sexo || ''; this.mostrarModal = true;
  }

  cerrarModal() {
    this.mostrarModal = false; this.estudianteEditar = null;
    this.sexoSeleccionado = ''; this.guardandoSexo = false;
  }

  guardarSexo() {
    if (!this.estudianteEditar) return;
    this.guardandoSexo = true;
    this.http.put(`${API}/${this.estudianteEditar._id}`, { sexo: this.sexoSeleccionado || null }).subscribe({
      next: (res: any) => {
        const idx = this.estudiantes.findIndex(e => e._id === res._id);
        if (idx !== -1) this.estudiantes[idx] = res;
        setTimeout(() => this.renderSexo(), 50); // re-render donut con dato local
        this.cerrarModal();
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.guardandoSexo = false;
        alert(err.error?.mensaje || 'Error al guardar'); this.cdr.detectChanges();
      }
    });
  }

  badgeSexo(sexo: string | null): string {
    const map: Record<string, string> = {
      'Masculino':         'bg-indigo-100 text-indigo-700 border-indigo-200',
      'Femenino':          'bg-pink-100 text-pink-700 border-pink-200',
      'Otro':              'bg-emerald-100 text-emerald-700 border-emerald-200',
      'Prefiero no decir': 'bg-amber-100 text-amber-700 border-amber-200',
    };
    return map[sexo ?? ''] ?? 'bg-slate-100 text-slate-500 border-slate-200';
  }
}
