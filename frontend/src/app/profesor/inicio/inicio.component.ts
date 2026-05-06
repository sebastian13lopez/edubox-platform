import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Curso } from '../../models/models';
import { CursoService } from '../../services/curso.service';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-profesor-inicio',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inicio.component.html',
  styleUrls: ['./inicio.component.scss']
})
export class InicioComponent implements OnInit {

  cursosAsignados: any[] = [];
  isLoadingCursos = false;

  mostrarModalMaterial = false;
  cursoSeleccionadoMaterial: string = '';
  nuevoMaterial = {
    titulo: '',
    descripcion: '',
    url: ''
  };
  guardandoMaterial = false;

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

  abrirModalMaterial(): void {
    if (this.cursosAsignados.length > 0) {
      this.cursoSeleccionadoMaterial = this.cursosAsignados[0]._id;
    }
    this.mostrarModalMaterial = true;
  }

  cerrarModalMaterial(): void {
    this.mostrarModalMaterial = false;
    this.nuevoMaterial = { titulo: '', descripcion: '', url: '' };
    this.cursoSeleccionadoMaterial = '';
  }

  guardarMaterial(): void {
    if (!this.cursoSeleccionadoMaterial || !this.nuevoMaterial.titulo) return;

    this.guardandoMaterial = true;
    this.cursoService.agregarMaterial(this.cursoSeleccionadoMaterial, this.nuevoMaterial).subscribe({
      next: (cursoActualizado) => {
        const index = this.cursosAsignados.findIndex(c => c._id === cursoActualizado._id);
        if (index !== -1) {
          this.cursosAsignados[index] = cursoActualizado;
        }
        this.guardandoMaterial = false;
        this.cerrarModalMaterial();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error al guardar material', err);
        this.guardandoMaterial = false;
        this.cdr.detectChanges();
      }
    });
  }

  // Navega al mapa geoespacial de estudiantes (Índice 2DSphere)
  irAlMapa(): void {
    this.router.navigate(['/profesor/mapa-estudiantes']);
  }
}

