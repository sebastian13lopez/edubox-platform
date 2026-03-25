import { Component, OnInit } from '@angular/core';
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
        },
        error: (err: any) => {
          console.error('Error al cargar cursos asignados', err);
          this.isLoadingCursos = false;
        }
      });
    }
  }

  iniciarClase(cursoColor: string): void {
    // Navega al aula en vivo al iniciar una clase
    this.router.navigate(['/profesor/aula-en-vivo']);
  }
}
