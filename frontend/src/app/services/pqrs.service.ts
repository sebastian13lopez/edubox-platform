import { environment } from '@env/environment';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface PQRS {
  _id: string;
  usuario_id: any;
  tipo: 'Petición' | 'Queja' | 'Reclamo' | 'Sugerencia';
  asunto: string;
  descripcion: string;
  estado: 'Pendiente' | 'En revisión' | 'Respondida' | 'Cerrada';
  radicado: string;
  createdAt: string;
}

export interface RespuestaPQRS {
  _id: string;
  pqrs_id: string;
  admin_id: any;
  contenido: string;
  correoEnviado: boolean;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class PqrsService {
  private api = environment.apiUrl + '/pqrs';

  constructor(private http: HttpClient) {}

  /** Crear nueva PQRS (estudiante/profesor) */
  crear(datos: { usuario_id: string; tipo: string; asunto: string; descripcion: string }): Observable<any> {
    return this.http.post(this.api, datos);
  }

  /** Listar PQRS — admin: todas | usuario: filtradas por usuario_id */
  listar(params?: { usuario_id?: string; estado?: string; buscar?: string }): Observable<PQRS[]> {
    return this.http.get<PQRS[]>(this.api, { params: params as any });
  }

  /** Ver detalle con respuesta */
  obtenerDetalle(id: string): Observable<{ pqrs: PQRS; respuesta: RespuestaPQRS | null }> {
    return this.http.get<any>(`${this.api}/${id}`);
  }

  /** Admin actualiza estado */
  actualizarEstado(id: string, estado: string): Observable<PQRS> {
    return this.http.put<PQRS>(`${this.api}/${id}/estado`, { estado });
  }

  /** Admin responde → envía correo con PDF */
  responder(id: string, admin_id: string, contenido: string): Observable<any> {
    return this.http.post(`${this.api}/${id}/responder`, { admin_id, contenido });
  }

  /** Estadísticas para dashboard admin */
  stats(): Observable<any> {
    return this.http.get(`${this.api}/stats/resumen`);
  }
}
