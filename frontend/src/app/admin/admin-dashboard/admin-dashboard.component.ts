import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth';
import { CursoService } from '../../services/curso.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule], // Importamos ReactiveFormsModule
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent implements OnInit {
  
  // Datos del dashboard previo
  profesoresPendientesCount: number = 0;
  solicitudesPendientes: any[] = [];

  // Datos de los cursos
  cursos: any[] = [];
  profesores: any[] = [];
  estudiantes: any[] = [];

  cursoForm: FormGroup;

  constructor(
    private router: Router,
    private http: HttpClient,
    private authService: AuthService,
    private cursoService: CursoService,
    private fb: FormBuilder
  ) {
    // Inicializar el formulario reactivo
    this.cursoForm = this.fb.group({
      nombre: ['', Validators.required],
      descripcion: [''],
      profesor_id: ['', Validators.required],
      estudiantes_ids: [[]] // Array vacío por defecto
    });
  }

  ngOnInit() {
    this.cargarSolicitudes(); // Del código anterior
    this.cargarCursos();
    this.cargarUsuarios();
  }

  cargarSolicitudes() {
    this.http.get('http://localhost:3000/api/usuarios/pendientes').subscribe({
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
    // Usamos HttpClient directo porque no había un usuario.service creado para esto
    this.http.get<any[]>('http://localhost:3000/api/usuarios').subscribe({
      next: (usuarios) => {
        this.profesores = usuarios.filter(u => u.rol === 'profesor');
        this.estudiantes = usuarios.filter(u => u.rol === 'estudiante');
      },
      error: (err) => console.error('Error cargando usuarios', err)
    });
  }

  guardarCurso() {
    if (this.cursoForm.valid) {
      this.cursoService.crearCurso(this.cursoForm.value).subscribe({
        next: (res) => {
          console.log('Curso creado exitosamente');
          this.cursoForm.reset();
          this.cargarCursos(); // Recargar la tabla
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

  // --- MÉTODOS ANTERIORES ---
  aprobarProfesor(id: number) { console.log('Aprobando', id); }
  rechazarProfesor(id: number) { console.log('Rechazando', id); }
  
  cerrarSesion() {
    this.authService.cerrarSesionLocal();
    this.router.navigate(['/login']);
  }
}
