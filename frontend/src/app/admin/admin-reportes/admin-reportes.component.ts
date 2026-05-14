import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { CursoService } from '../../services/curso.service';

@Component({
  selector: 'app-admin-reportes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-reportes.component.html',
  styles: []
})
export class AdminReportesComponent implements OnInit {

  // ── Datos crudos y filtrados ──────────────────────────────
  todosLosReportes: any[] = [];
  reportesFiltrados: any[] = [];
  isLoading = true;

  // ── Totales Reales ─────────────────────────────────────────
  totalDocentesReales = 0;
  totalCursosReales   = 0;

  // ── Filtros ───────────────────────────────────────────────
  busqueda         = '';
  filtroDocente    = '';
  filtroCurso      = '';

  // ── Listas para los selects ───────────────────────────────
  docentes: string[] = [];
  cursos:   string[] = [];

  // ── Modal ─────────────────────────────────────────────────
  selectedRep: any = null;

  // ── Paginación ────────────────────────────────────────────
  pagina      = 1;
  porPagina   = 10;
  Math = Math; // Exponer Math para el template

  get totalPaginas(): number {
    return Math.ceil(this.reportesFiltrados.length / this.porPagina);
  }

  get reportesPagina(): any[] {
    const inicio = (this.pagina - 1) * this.porPagina;
    return this.reportesFiltrados.slice(inicio, inicio + this.porPagina);
  }

  // ── Métricas ──────────────────────────────────────────────
  get totalPalabras(): number {
    return this.todosLosReportes.reduce((s, r) => s + (r.estadisticas?.palabras ?? 0), 0);
  }

  get totalSesiones(): number { return this.todosLosReportes.length; }

  get docentesActivos(): number { return this.totalDocentesReales; }

  get cursosConClases(): number { return this.totalCursosReales; }

  constructor(
    private cursoService: CursoService,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.isLoading = true;

    forkJoin({
      usuarios: this.http.get<any[]>('http://localhost:3000/api/usuarios').pipe(
        catchError(err => { console.error('Error cargando usuarios:', err); return of([]); })
      ),
      cursos: this.cursoService.obtenerTodosLosCursos().pipe(
        catchError(err => { console.error('Error cargando cursos:', err); return of([]); })
      ),
      historiales: this.cursoService.obtenerTodosLosHistoriales().pipe(
        catchError(err => { console.error('Error cargando historiales:', err); return of([]); })
      )
    }).subscribe({
      next: (res) => {
        console.log('Resultados de la API:', res);
        // Calcular totales reales
        const profesores = res.usuarios.filter(u => u.rol === 'profesor');
        this.totalDocentesReales = profesores.length;
        this.totalCursosReales   = res.cursos.length;

        // Construir listas completas para los selects
        this.docentes = profesores.map((p: any) => p.nombre).sort();
        this.cursos   = res.cursos.map((c: any) => c.nombre).sort();

        this.todosLosReportes = res.historiales.map(r => ({
          ...r,
          fechaFormateada: new Date(r.fecha).toLocaleDateString('es-ES', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
          })
        }));

        this.aplicarFiltros();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  aplicarFiltros() {
    const q  = this.busqueda.trim().toLowerCase();
    this.reportesFiltrados = this.todosLosReportes.filter(r => {
      const matchBusqueda  = !q ||
        r.textoCompleto?.toLowerCase().includes(q) ||
        r.profesor_id?.nombre?.toLowerCase().includes(q) ||
        r.curso_id?.nombre?.toLowerCase().includes(q);
      const matchDocente   = !this.filtroDocente || r.profesor_id?.nombre === this.filtroDocente;
      const matchCurso     = !this.filtroCurso   || r.curso_id?.nombre === this.filtroCurso;
      return matchBusqueda && matchDocente && matchCurso;
    });
    this.pagina = 1; // Resetear a primera página al filtrar
  }

  limpiarFiltros() {
    this.busqueda = ''; this.filtroDocente = ''; this.filtroCurso = '';
    this.aplicarFiltros();
  }

  verTexto(rep: any)  { this.selectedRep = rep; }
  cerrarModal()       { this.selectedRep = null; }

  irPagina(p: number) {
    if (p >= 1 && p <= this.totalPaginas) this.pagina = p;
  }

  get paginas(): number[] {
    const total = this.totalPaginas;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (this.pagina <= 4) return [1,2,3,4,5,0,total];
    if (this.pagina >= total - 3) return [1,0,total-4,total-3,total-2,total-1,total];
    return [1,0,this.pagina-1,this.pagina,this.pagina+1,0,total];
  }

  palabrasLabel(palabras: number): string {
    if (palabras === 0) return '0 palabras';
    if (palabras < 50)  return `${palabras} palabras`;
    if (palabras < 200) return `${palabras} palabras`;
    return `${palabras} palabras`;
  }

  duracionColor(palabras: number): string {
    if (palabras === 0)    return 'bg-slate-100 text-slate-500 border-slate-200';
    if (palabras < 100)    return 'bg-sky-100 text-sky-700 border-sky-200';
    if (palabras < 500)    return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    return 'bg-indigo-100 text-indigo-700 border-indigo-200';
  }
}
