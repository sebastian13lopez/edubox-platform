import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './register.html',
  styleUrls: ['./register.css'],
})
export class Register {
  nuevoUsuario: any = {
    nombre: '',
    correo: '',
    password: '',
    rol: 'Estudiante',
    sexo: '',
    telefono: '',
    tituloProfesional: ''
  };

  showPassword = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  // ── Indicador de fortaleza de contraseña ─────────────────────────
  get passwordStrength(): { level: number; label: string; color: string; barColor: string; segments: boolean[] } {
    const pwd = this.nuevoUsuario.password || '';
    if (!pwd) return { level: 0, label: '', color: '', barColor: '', segments: [false, false, false] };

    let score = 0;
    if (pwd.length >= 8)                     score++; // Longitud mínima
    if (pwd.length >= 12)                    score++; // Longitud larga
    if (/[A-Z]/.test(pwd))                   score++; // Mayúscula
    if (/[0-9]/.test(pwd))                   score++; // Número
    if (/[^A-Za-z0-9]/.test(pwd))            score++; // Carácter especial

    if (score <= 1) {
      return { level: 1, label: 'Débil', color: 'text-red-500', barColor: 'bg-red-500', segments: [true, false, false] };
    } else if (score <= 3) {
      return { level: 2, label: 'Media', color: 'text-amber-500', barColor: 'bg-amber-500', segments: [true, true, false] };
    } else {
      return { level: 3, label: 'Fuerte', color: 'text-emerald-500', barColor: 'bg-emerald-500', segments: [true, true, true] };
    }
  }

  registrar() {
    this.authService.register(this.nuevoUsuario).subscribe({
      next: (res) => {
        alert('Cuenta creada con éxito');
        this.router.navigate(['/login']);
      },
      error: (err) => {
        const errorMsg = err.error?.mensaje || 'Error al registrar';
        alert('Error: ' + errorMsg);
      }
    });
  }
}
