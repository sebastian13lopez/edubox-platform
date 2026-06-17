import { environment } from '@env/environment';
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private API_URL = environment.apiUrl + '/auth';
  private USUARIOS_URL = environment.apiUrl + '/usuarios';

  constructor(private http: HttpClient) { }

  // Función para enviar los datos de login
  login(credenciales: any): Observable<any> {
    return this.http.post(`${this.API_URL}/login`, credenciales);
  }

  // Función para enviar los datos de registro
  register(usuario: any): Observable<any> {
    return this.http.post(`${this.API_URL}/register`, usuario);
  }

  // Guardar datos en el navegador del usuario
  guardarToken(token: string, rol: string, nombre: string = 'Usuario', correo: string = '', id: string = '', estado: string = '') {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_rol', rol);
    localStorage.setItem('auth_nombre', nombre);
    localStorage.setItem('auth_correo', correo);
    if (id) localStorage.setItem('auth_id', id);
    if (estado) localStorage.setItem('auth_estado', estado);
  }

  getIdUsuario(): string {
    return localStorage.getItem('auth_id') || '';
  }

  getNombreUsuario(): string {
    return localStorage.getItem('auth_nombre') || 'Usuario';
  }

  getEstadoUsuario(): string {
    return localStorage.getItem('auth_estado') || '';
  }

  getCorreoUsuario(): string {
    return localStorage.getItem('auth_correo') || 'correo@ejemplo.com';
  }

  estaAutenticado(): boolean {
    return !!localStorage.getItem('auth_token');
  }

  obtenerRol(): string | null {
    return localStorage.getItem('auth_rol');
  }

  cerrarSesionLocal() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_rol');
    localStorage.removeItem('auth_nombre');
    localStorage.removeItem('auth_correo');
    localStorage.removeItem('auth_id');
    localStorage.removeItem('auth_estado');
  }

  // ─────────────────────────────────────────────────────────────
  // GEOLOCALIZACIÓN — Índice 2DSphere
  // ─────────────────────────────────────────────────────────────

  /**
   * Solicita permiso de geolocalización al navegador.
   * Se llama justo después de un login exitoso.
   * Si el usuario rechaza el permiso, el login NO se bloquea.
   */
  obtenerUbicacion(): Promise<{ latitud: number; longitud: number }> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalización no soportada por este navegador'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            latitud: pos.coords.latitude,
            longitud: pos.coords.longitude
          });
        },
        (err) => {
          console.warn('⚠️ Permiso de ubicación denegado:', err.message);
          reject(err);
        },
        { timeout: 8000, enableHighAccuracy: true }
      );
    });
  }

  /**
   * Envía las coordenadas al backend para actualizar el campo
   * 'ubicacion' del usuario (activa el índice 2DSphere).
   */
  actualizarUbicacion(usuarioId: string, latitud: number, longitud: number): Observable<any> {
    return this.http.put(
      `${this.USUARIOS_URL}/${usuarioId}/ubicacion`,
      { latitud, longitud }
    );
  }
}