import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { CursoService } from '../../services/curso.service';
import { AuthService } from '../../services/auth';
import { timeout, catchError } from 'rxjs/operators';
import { of, interval, Subscription } from 'rxjs';

@Component({
  selector: 'app-estudiante-inicio',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './inicio.component.html',
  styleUrls: ['./inicio.component.scss']
})
export class InicioComponent implements OnInit, OnDestroy {

  misCursos: any[] = [];
  isLoading = true;
  errorCarga = false;
  nombreEstudiante: string = '';

  usuariosActivos: any[] = [];
  eventosSala: { texto: string; icono: string; color: string; tiempo: string }[] = [];
  private pollingSub?: Subscription;

  constructor(
    private cdr: ChangeDetectorRef,
    private router: Router,
    private cursoService: CursoService,
    private authService: AuthService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    // 1. Obtener datos del estudiante actual desde LocalStorage
    const estudianteId = this.authService.getIdUsuario();
    this.nombreEstudiante = this.authService.getNombreUsuario();

    // Safety: apagar el spinner si no hay ID
    if (!estudianteId) {
      this.isLoading = false;
      this.cdr.detectChanges();
      return;
    }

    // 2. Fetch de sus cursos con timeout de 8 segundos para evitar spinner infinito
    this.cursoService.obtenerCursosEstudiante(estudianteId)
      .pipe(
        timeout(8000),
        catchError(err => {
          console.error('Error al cargar cursos (o timeout):', err);
          this.errorCarga = true;
          return of([]); // Retorna array vacío en caso de fallo
        })
      )
      .subscribe((cursos: any) => {
        this.misCursos = Array.isArray(cursos) ? cursos : [];
        this.isLoading = false;
        
        if (this.misCursos.length > 0) {
          this.iniciarPollingActivos(this.misCursos[0]._id);
        }
        
        this.cdr.detectChanges();
      });
  }

  entrarAulaVirtual(curso: any): void {
    // Guardamos la información del curso seleccionado para que el componente "AulaEnVivo" lo recoja
    localStorage.setItem('claseActual', JSON.stringify({
      id: curso._id,
      nombre: curso.nombre,
      profesor: curso.profesor_id?.nombre || 'Profesor Designado'
    }));
    this.router.navigate(['/estudiante/aula-en-vivo']);
  }

  mostrarModalMateriales = false;
  materialesSeleccionados: any[] = [];
  cursoSeleccionadoNombre: string = '';

  verMateriales(curso: any): void {
    this.materialesSeleccionados = curso.materiales || [];
    this.cursoSeleccionadoNombre = curso.nombre;
    this.mostrarModalMateriales = true;
  }

  cerrarModalMateriales(): void {
    this.mostrarModalMateriales = false;
    this.materialesSeleccionados = [];
    this.cursoSeleccionadoNombre = '';
  }

  recargar(): void {
    this.isLoading = true;
    this.errorCarga = false;
    this.misCursos = [];
    if (this.pollingSub) this.pollingSub.unsubscribe();
    this.usuariosActivos = [];
    this.eventosSala = [];
    this.cdr.detectChanges();
    this.ngOnInit();
  }

  iniciarPollingActivos(cursoId: string) {
    this.fetchActivos(cursoId);
    this.pollingSub = interval(4000).subscribe(() => {
      this.fetchActivos(cursoId);
    });
  }

  fetchActivos(cursoId: string) {
    this.http.get<any[]>(`http://localhost:3000/api/cursos/${cursoId}/activos`)
      .pipe(
        timeout(3000),
        catchError(() => of([]))
      )
      .subscribe(usuarios => {
         const nuevos = usuarios.filter(u => !this.usuariosActivos.find(viejo => viejo.idUsuario === u.idUsuario));
         const seFueron = this.usuariosActivos.filter(viejo => !usuarios.find(u => u.idUsuario === viejo.idUsuario));
         const ahora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

         nuevos.forEach(u => {
            const isProfe = u.rol === 'profesor';
            this.eventosSala.unshift({
              texto: isProfe ? `El profesor ${u.nombre} ingresó al salón.` : `${u.nombre} se unió.`,
              icono: isProfe ? 'profesor' : 'estudiante',
              color: isProfe ? 'text-blue-500' : 'text-slate-500',
              tiempo: ahora
            });
         });
         
         seFueron.forEach(u => {
            this.eventosSala.unshift({
              texto: `${u.nombre} salió.`,
              icono: 'salida',
              color: 'text-red-400',
              tiempo: ahora
            });
         });

         if (this.eventosSala.length > 5) {
           this.eventosSala = this.eventosSala.slice(0, 5);
         }

         this.usuariosActivos = usuarios;
         this.cdr.detectChanges();
      });
  }

  get profesorConectado(): boolean {
    return this.usuariosActivos.some(u => u.rol === 'profesor');
  }

  get totalEstudiantes(): number {
    return this.usuariosActivos.filter(u => u.rol !== 'profesor').length;
  }

  ngOnDestroy() {
    if (this.pollingSub) {
      this.pollingSub.unsubscribe();
    }
  }
}
