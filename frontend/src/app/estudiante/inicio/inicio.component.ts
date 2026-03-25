import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CursoService } from '../../services/curso.service';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-estudiante-inicio',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './inicio.component.html',
  styleUrls: ['./inicio.component.scss']
})
export class InicioComponent implements OnInit {

  misCursos: any[] = [];
  isLoading = true;
  nombreEstudiante: string = '';

  constructor(
    private cdr: ChangeDetectorRef,
    private router: Router,
    private cursoService: CursoService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    // 1. Obtener datos del estudiante actual desde LocalStorage a través del Service
    const estudianteId = this.authService.getIdUsuario();
    this.nombreEstudiante = this.authService.getNombreUsuario();

    // 2. Fetch de sus cursos inyectando CursoService
    if (estudianteId) {
      this.cursoService.obtenerCursosEstudiante(estudianteId).subscribe({
        next: (cursos: any) => {
          this.misCursos = cursos;
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          console.error('Error al cargar cursos asignados', err);
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      });
    } else {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
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
}
