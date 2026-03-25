import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-admin-profesores',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-profesores.component.html',
  styles: []
})
export class AdminProfesoresComponent implements OnInit {
  
  profesores: any[] = [];
  cargando: boolean = true;
  procesandoId: string | null = null;

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.cargarProfesores();
  }

  cargarProfesores() {
    this.cargando = true;
    this.cdr.detectChanges(); // Forzamos actualización visual al inicio

    this.http.get<any>('http://localhost:3000/api/usuarios').subscribe({
      next: (res: any) => {
        try {
          console.log('Respuesta cruda del backend:', res);
          // Verificar si es un array o viene encapsulado
          const data = Array.isArray(res) ? res : (res?.data && Array.isArray(res.data) ? res.data : []);
          
          // Filtramos solo el rol profesor
          this.profesores = data.filter((u: any) => u.rol === 'profesor');
        } catch (e) {
          console.error('Error filtrando los profesores del array:', e);
        } finally {
          this.cargando = false;
          this.cdr.detectChanges(); // Forzar actualización visual
        }
      },
      error: (err: any) => {
        console.error('Error HTTP cargando profesores:', err);
        // Aunque haya error, apagamos el spinner
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  aprobarProfesor(id: string) {
    if(!confirm('¿Estás seguro de APROBAR este docente? Recibirá acceso inmediato a la creación de aulas.')) return;
    
    this.procesandoId = id;
    this.cdr.detectChanges();

    this.http.put(`http://localhost:3000/api/usuarios/profesor/aprobar/${id}`, {}).subscribe({
      next: (res: any) => {
        this.procesandoId = null;
        // Actualizamos estado en UI localmente sin recargar todo
        const prof = this.profesores.find((p: any) => p._id === id);
        if (prof) prof.estado = 'Aprobado';
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.procesandoId = null;
        console.error('Error aprobando', err);
        alert('Ocurrió un error al aprobar.');
        this.cdr.detectChanges();
      }
    });
  }

  rechazarProfesor(id: string) {
    if(!confirm('¿Estás seguro de RECHAZAR y ELIMINAR permanentemente esta solicitud del sistema?')) return;

    this.procesandoId = id;
    this.cdr.detectChanges();

    this.http.delete(`http://localhost:3000/api/usuarios/${id}`).subscribe({
      next: () => {
        this.procesandoId = null;
        // Quitar de la lista local
        this.profesores = this.profesores.filter((p: any) => p._id !== id);
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.procesandoId = null;
        console.error('Error rechazando', err);
        alert('Ocurrió un error al rechazar/eliminar.');
        this.cdr.detectChanges();
      }
    });
  }
}
