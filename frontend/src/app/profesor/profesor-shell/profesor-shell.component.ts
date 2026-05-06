import { Component, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth';
import { Router } from '@angular/router';

@Component({
  selector: 'app-profesor-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './profesor-shell.component.html',
  styleUrls: ['./profesor-shell.component.scss']
})
export class ProfesorShellComponent implements OnInit {

  nombreProfesor = '';
  estadoProfesor = '';

  // Menú lateral — cada item tiene routerLink relativo al shell
  navItems = [
    {
      path: 'inicio',
      label: 'Inicio / Clases',
      icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'
    },
    {
      path: 'aula-en-vivo',
      label: 'Aula en Vivo',
      icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z'
    },
    {
      path: 'historial',
      label: 'Historial y Reportes',
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2'
    },
    {
      path: 'perfil',
      label: 'Mi Perfil',
      icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'
    },
    {
      path: 'mapa-estudiantes',
      label: 'Mapa de Estudiantes',
      icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z'
    },
  ];

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit(): void {
    this.nombreProfesor = this.authService.getNombreUsuario();
    // Normalizamos el estado para no tener problemas de mayúsculas
    this.estadoProfesor = (this.authService.getEstadoUsuario() || '').trim().toLowerCase();
  }

  onLogout(): void {
    this.authService.cerrarSesionLocal();
    this.router.navigate(['/login']);
  }
}
