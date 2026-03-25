import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Curso } from '../../models/models';
import { CursoService } from '../../services/curso.service';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-profesor-inicio',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './inicio.component.html',
  styleUrls: ['./inicio.component.scss']
})
export class InicioComponent implements OnInit {

  cursosAsignados: any[] = [];
  isLoadingCursos = false;

  constructor(
    private cdr: ChangeDetectorRef,
    private router: Router,
    private cursoService: CursoService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const profesorId = this.authService.getIdUsuario();
    
    if (profesorId) {
      this.isLoadingCursos = true;
      this.cursoService.obtenerCursosProfesor(profesorId).subscribe({
        next: (data: any) => {
          this.cursosAsignados = data;
          this.isLoadingCursos = false;
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          console.error('Error al cargar cursos asignados', err);
          this.isLoadingCursos = false;
          this.cdr.detectChanges();
        }
      });
    }
  }

  iniciarClase(curso: any): void {
    localStorage.setItem('claseActual', JSON.stringify({
      id: curso._id,
      nombre: curso.nombre,
      profesor: curso.profesor_id?.nombre || 'Yo',
      color: curso.color || '#2563EB'
    }));
    this.router.navigate(['/profesor/aula-en-vivo']);
  }
}
