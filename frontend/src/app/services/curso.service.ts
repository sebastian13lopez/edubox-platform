import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CursoService {
  private apiUrl = 'http://localhost:3000/api/cursos';

  constructor(private http: HttpClient) { }

  crearCurso(datosCurso: any): Observable<any> {
    return this.http.post<any>(this.apiUrl, datosCurso);
  }

  obtenerTodosLosCursos(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  obtenerCursosProfesor(profesorId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/profesor/${profesorId}`);
  }

  obtenerCursosEstudiante(estudianteId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/estudiante/${estudianteId}`);
  }

  agregarMaterial(cursoId: string, materialData: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${cursoId}/material`, materialData);
  }

  // === MÓDULO DE HISTORIAL DE TRANSCRIPCIONES === //

  obtenerTodosLosHistoriales(): Observable<any[]> {
    return this.http.get<any[]>('http://localhost:3000/api/historial');
  }

  guardarHistorialClase(datos: any): Observable<any> {
    return this.http.post<any>('http://localhost:3000/api/historial', datos);
  }

  obtenerHistorialesPorCurso(cursoId: string): Observable<any[]> {
    return this.http.get<any[]>(`http://localhost:3000/api/historial/curso/${cursoId}`);
  }

  obtenerHistorialesPorEstudiante(estudianteId: string): Observable<any[]> {
    return this.http.get<any[]>(`http://localhost:3000/api/historial/estudiante/${estudianteId}`);
  }

  obtenerHistorialesPorProfesor(profesorId: string): Observable<any[]> {
    return this.http.get<any[]>(`http://localhost:3000/api/historial/profesor/${profesorId}`);
  }
}
