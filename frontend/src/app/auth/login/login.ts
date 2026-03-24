import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms'; // Para capturar lo que escribes
import { AuthService } from '../../services/auth'; // Nuestro mensajero
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class Login {
  datos = {
    correo: '',
    password: ''
  };

  showPassword = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  onLogin() {
    this.authService.login(this.datos).subscribe({
      next: (res) => {
        // Guardar el token usando el servicio
        const token = res.token || 'dummy-token'; 
        const rol = res.rol || 'Estudiante'; // Default safety fallback
        const nombre = res.nombre || 'Usuario';
        const correo = this.datos.correo || '';
        const id = res.id || '';
        const estado = res.estado || '';
        this.authService.guardarToken(token, rol, nombre, correo, id, estado);

        // Redirigir dependiendo del Rol (estandarizado a minúsculas para coincidir con backend)
        const rolNormalize = rol.toLowerCase();
        
        if (rolNormalize === 'admin' || rolNormalize === 'administrador') {
          this.router.navigate(['/admin']);
        } else if (rolNormalize === 'profesor') {
          this.router.navigate(['/profesor']);
        } else if (rolNormalize === 'estudiante') {
          this.router.navigate(['/estudiante']);
        } else {
          // Fallback en caso de otro rol
          alert(`¡Hola ${res.nombre}! Iniciaste sesión como ${rol}.`);
        }
      },
      error: (err) => {
        const msg = err.error?.mensaje || 'Error de credenciales';
        alert('Error: ' + msg);
      }
    });
  }
}