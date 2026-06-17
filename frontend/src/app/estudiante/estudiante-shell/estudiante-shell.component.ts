import { Component, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth';
import { Router } from '@angular/router';
import { NotificationService, AppNotification } from '../../services/notification.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-estudiante-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './estudiante-shell.component.html',
  styleUrls: ['./estudiante-shell.component.scss']
})
export class EstudianteShellComponent implements OnInit {

  nombreEstudiante = '';
  
  // Estado de Notificaciones
  notificaciones: AppNotification[] = [];
  noLeidasCount: number = 0;
  mostrarDropdownNotificaciones = false;
  private notifSub!: Subscription;

  navItems = [
    {
      path: 'inicio',
      label: 'Inicio',
      icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'
    },
    {
      path: 'aula-en-vivo',
      label: 'Aula en Vivo',
      icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z'
    },
    {
      path: 'historial',
      label: 'Historial',
      icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
    },
    {
      path: 'perfil',
      label: 'Mi Perfil',
      icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'
    },
    {
      path: 'pqrs',
      label: 'PQRS',
      icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z'
    },
  ];

  constructor(
    private authService: AuthService, 
    private router: Router,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.nombreEstudiante = this.authService.getNombreUsuario();
    
    // Suscribirse a las notificaciones globales
    this.notifSub = this.notificationService.getNotificaciones().subscribe(notifs => {
      this.notificaciones = notifs;
      this.noLeidasCount = this.notificaciones.filter(n => !n.leida).length;
    });
  }

  toggleNotificaciones(): void {
    this.mostrarDropdownNotificaciones = !this.mostrarDropdownNotificaciones;
    if (this.mostrarDropdownNotificaciones && this.noLeidasCount > 0) {
      this.notificationService.marcarComoLeidas();
    }
  }

  ngOnDestroy(): void {
    if (this.notifSub) {
      this.notifSub.unsubscribe();
    }
    this.notificationService.desconectar();
  }

  onLogout(): void {
    this.authService.cerrarSesionLocal();
    this.router.navigate(['/login']);
  }
}
