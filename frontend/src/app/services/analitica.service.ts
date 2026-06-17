import { environment } from '@env/environment';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface QuizData {
  pregunta: string;
  opciones: string[];
  correcta: string;
}

export interface DashboardStudent {
  estudiante_id: string;
  nombre: string;
  score: number;
  focusLostCount: number;
  correctQuizCount: number;
  estado: string;
}

@Injectable({
  providedIn: 'root'
})
export class AnaliticaService {
  private apiUrl = environment.apiUrl + '/analitica';

  constructor(private http: HttpClient) {}

  registrarEvento(estudiante_id: string, clase_id: string, tipo_evento: string, valor: number = 0): Observable<any> {
    return this.http.post(`${this.apiUrl}/registrar`, {
      estudiante_id,
      clase_id,
      tipo_evento,
      valor
    });
  }

  obtenerDashboard(cursoId: string): Observable<DashboardStudent[]> {
    return this.http.get<DashboardStudent[]>(`${this.apiUrl}/dashboard/${cursoId}`);
  }

  generarQuiz(texto: string, claseId?: string): Observable<QuizData> {
    return this.http.post<QuizData>(`${this.apiUrl}/generar-quiz`, { texto, claseId });
  }

  obtenerDashboardGlobal(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/dashboard/admin`);
  }

  obtenerDashboardProfesor(profesorId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/dashboard/profesor/${profesorId}`);
  }
}
