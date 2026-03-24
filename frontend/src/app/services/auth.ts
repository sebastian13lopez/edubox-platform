import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // Esta es la dirección de tu "cerebro" (Backend)
  private API_URL = 'http://localhost:3000/api/auth';

  constructor(private http: HttpClient) { }

  // Función para enviar los datos de login
  login(credenciales: any): Observable<any> {
    return this.http.post(`${this.API_URL}/login`, credenciales);
  }

  // Función para enviar los datos de registro
  register(usuario: any): Observable<any> {
    return this.http.post(`${this.API_URL}/register`, usuario);
  }

  // --- Novedades para Protección de Rutas ---

  // Guardar datos en el navegador del usuario
  guardarToken(token: string, rol: string, nombre: string = 'Usuario', correo: string = '', id: string = '', estado: string = '') {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_rol', rol);
    localStorage.setItem('auth_nombre', nombre);
    localStorage.setItem('auth_correo', correo);
    if(id) localStorage.setItem('auth_id', id);
    if(estado) localStorage.setItem('auth_estado', estado);
  }

  // Obtener id del usuario
  getIdUsuario(): string {
    return localStorage.getItem('auth_id') || '';
  }

  // Obtener nombre del usuario
  getNombreUsuario(): string {
    return localStorage.getItem('auth_nombre') || 'Usuario';
  }

  // Obtener estado del usuario (ej: Pendiente o Aprobado)
  getEstadoUsuario(): string {
    return localStorage.getItem('auth_estado') || '';
  }

  // Obtener correo del usuario
  getCorreoUsuario(): string {
    return localStorage.getItem('auth_correo') || 'correo@ejemplo.com';
  }

  // Comprueba si hay un token guardado (es decir, si "inició sesión")
  estaAutenticado(): boolean {
    return !!localStorage.getItem('auth_token');
  }

  // Obtener el rol actual para permisos
  obtenerRol(): string | null {
    return localStorage.getItem('auth_rol');
  }

  // Borrar los datos al cerrar sesión
  cerrarSesionLocal() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_rol');
    localStorage.removeItem('auth_nombre');
    localStorage.removeItem('auth_correo');
    localStorage.removeItem('auth_id');
    localStorage.removeItem('auth_estado');
  }
}