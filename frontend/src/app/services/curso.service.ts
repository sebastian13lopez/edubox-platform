import { environment } from '@env/environment';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CursoService {
  private apiUrl = environment.apiUrl + '/cursos';

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
    return this.http.get<any[]>(environment.apiUrl + '/historial');
  }

  guardarHistorialClase(datos: any): Observable<any> {
    return this.http.post<any>(environment.apiUrl + '/historial', datos);
  }

  obtenerHistorialesPorCurso(cursoId: string): Observable<any[]> {
    return this.http.get<any[]>(environment.apiUrl + '/historial/curso/${cursoId}');
  }

  obtenerHistorialesPorEstudiante(estudianteId: string): Observable<any[]> {
    return this.http.get<any[]>(environment.apiUrl + '/historial/estudiante/${estudianteId}');
  }

  obtenerHistorialesPorProfesor(profesorId: string): Observable<any[]> {
    return this.http.get<any[]>(environment.apiUrl + '/historial/profesor/${profesorId}');
  }

  descargarReportePDF(historialId: string, rol: string): Observable<Blob> {
    return this.http.get(environment.apiUrl + '/historial/${historialId}/pdf'?role=${rol}`, {
      responseType: 'blob'
    });
  }
}
