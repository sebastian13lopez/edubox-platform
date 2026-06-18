import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class Login {
  datos = {
    correo: '',
    password: ''
  };

  showPassword = false;
  cargando = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  onLogin() {
    this.cargando = true;

    this.authService.login(this.datos).subscribe({
      next: (res) => {
        // 1. Guardar el token y datos de sesión
        const token  = res.token  || 'dummy-token';
        const rol    = res.rol    || 'estudiante';
        const nombre = res.nombre || 'Usuario';
        const correo = this.datos.correo || '';
        const id     = res.id    || '';
        const estado = res.estado || '';
        this.authService.guardarToken(token, rol, nombre, correo, id, estado);

        // 2. Capturar geolocalización en segundo plano (no bloquea el login)
        //    Al obtener las coordenadas se actualiza el índice 2DSphere en MongoDB.
        if (id) {
          this.authService.obtenerUbicacion()
            .then(({ latitud, longitud }) => {
              this.authService.actualizarUbicacion(id, latitud, longitud).subscribe({
                next: () => console.log(`📍 Ubicación registrada: [${latitud}, ${longitud}]`),
                error: (e: any) => console.warn('No se pudo guardar la ubicación:', e.message)
              });
            })
            .catch(() => {
              // El usuario rechazó el permiso — el login continúa igualmente
              console.warn('📍 Ubicación no disponible, se continúa sin ella.');
            });
        }

        // 3. Redirigir según el rol
        this.cargando = false;
        const rolNorm = rol.toLowerCase();
        if (rolNorm === 'admin' || rolNorm === 'administrador') {
          this.router.navigate(['/admin']);
        } else if (rolNorm === 'profesor') {
          this.router.navigate(['/profesor']);
        } else if (rolNorm === 'estudiante') {
          this.router.navigate(['/estudiante']);
        } else {
          alert(`¡Hola ${res.nombre}! Iniciaste sesión como ${rol}.`);
        }
      },
      error: (err) => {
        this.cargando = false;
        const msg = err.error?.mensaje || 'Error de credenciales';
        alert('Error: ' + msg);
      }
    });
  }
}