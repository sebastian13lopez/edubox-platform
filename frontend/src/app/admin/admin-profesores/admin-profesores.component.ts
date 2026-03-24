import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';

@Component({
  selector: 'app-admin-profesores',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  templateUrl: './admin-profesores.component.html',
  styles: []
})
export class AdminProfesoresComponent implements OnInit {
  
  profesores: any[] = [];
  cargando: boolean = true;
  procesandoId: string | null = null;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.cargarProfesores();
  }

  cargarProfesores() {
    this.cargando = true;
    // Traemos a todos los usuarios
    this.http.get<any[]>('http://localhost:3000/api/usuarios').subscribe({
      next: (usuarios: any[]) => {
        // Filtramos solo el rol profesor
        this.profesores = usuarios.filter((u: any) => u.rol === 'profesor');
        this.cargando = false;
      },
      error: (err: any) => {
        console.error('Error cargando profesores', err);
        this.cargando = false;
      }
    });
  }

  aprobarProfesor(id: string) {
    if(!confirm('¿Estás seguro de APROBAR este docente? Recibirá acceso inmediato a la creación de aulas.')) return;
    
    this.procesandoId = id;
    this.http.put(`http://localhost:3000/api/usuarios/profesor/aprobar/${id}`, {}).subscribe({
      next: (res: any) => {
        this.procesandoId = null;
        // Actualizamos estado en UI localmente sin recargar todo
        const prof = this.profesores.find((p: any) => p._id === id);
        if (prof) prof.estado = 'Aprobado';
      },
      error: (err: any) => {
        this.procesandoId = null;
        console.error('Error aprobando', err);
        alert('Ocurrió un error al aprobar.');
      }
    });
  }

  rechazarProfesor(id: string) {
    if(!confirm('¿Estás seguro de RECHAZAR y ELIMINAR permanentemente esta solicitud del sistema?')) return;

    this.procesandoId = id;
    this.http.delete(`http://localhost:3000/api/usuarios/${id}`).subscribe({
      next: () => {
        this.procesandoId = null;
        // Quitar de la lista local
        this.profesores = this.profesores.filter((p: any) => p._id !== id);
      },
      error: (err: any) => {
        this.procesandoId = null;
        console.error('Error rechazando', err);
        alert('Ocurrió un error al rechazar/eliminar.');
      }
    });
  }
}
