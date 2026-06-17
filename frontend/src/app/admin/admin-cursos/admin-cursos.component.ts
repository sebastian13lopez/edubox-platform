import { environment } from '@env/environment';
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CursoService } from '../../services/curso.service';

@Component({
  selector: 'app-admin-cursos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-cursos.component.html',
  styles: []
})
export class AdminCursosComponent implements OnInit {
  // Datos de los cursos
  cursos: any[] = [];
  profesores: any[] = [];
  estudiantes: any[] = [];

  cursoForm: FormGroup;

  // Variables para feedback UI
  eliminandoCursoId: string | null = null;
  publicandoCurso: boolean = false;

  constructor(
    private router: Router,
    private http: HttpClient,
    private cursoService: CursoService,
    private fb: FormBuilder
  ) {
    // Inicializar el formulario reactivo
    this.cursoForm = this.fb.group({
      nombre: ['', Validators.required],
      descripcion: [''],
      // Solo profesores aprobados o activos deberían listarse
      profesor_id: ['', Validators.required],
      estudiantes_ids: [[]] // Array vacío por defecto
    });
  }

  ngOnInit() {
    this.cargarCursos();
    this.cargarUsuarios();
  }

  cargarCursos() {
    this.cursoService.obtenerTodosLosCursos().subscribe({
      next: (data: any) => this.cursos = data,
      error: (err: any) => console.error('Error cargando cursos', err)
    });
  }

  cargarUsuarios() {
    // Usamos HttpClient directo al servidor backend
    this.http.get<any[]>(environment.apiUrl + '/usuarios').subscribe({
      next: (usuarios: any[]) => {
        // Evitamos que asigne cursos a profesores pendientes/rechazados si aplicara
        this.profesores = usuarios.filter((u: any) => u.rol === 'profesor' && u.estado !== 'Pendiente');
        this.estudiantes = usuarios.filter((u: any) => u.rol === 'estudiante');
      },
      error: (err: any) => console.error('Error cargando usuarios', err)
    });
  }

  guardarCurso() {
    if (this.cursoForm.valid) {
      this.publicandoCurso = true;
      this.cursoService.crearCurso(this.cursoForm.value).subscribe({
        next: (res: any) => {
          this.publicandoCurso = false;
          this.cursoForm.reset();
          this.cargarCursos(); // Recargar la tabla
        },
        error: (err: any) => {
          this.publicandoCurso = false;
          console.error('Error al crear curso', err);
          alert('Hubo un error al crear el curso');
        }
      });
    }
  }

  eliminarCurso(id: string) {
    if(confirm('¿Estás seguro de eliminar PERMANENTEMENTE este curso? Esta acción no se puede deshacer.')) {
      this.eliminandoCursoId = id;
      this.http.delete(environment.apiUrl + '/cursos'/' + id).subscribe({
        next: () => {
          this.eliminandoCursoId = null;
          this.cursos = this.cursos.filter(c => c._id !== id);
        },
        error: (err: any) => {
          this.eliminandoCursoId = null;
          console.error(err);
          alert('Hubo un error al borrar el curso');
        }
      });
    }
  }
}
