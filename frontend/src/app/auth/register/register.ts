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
  nuevoUsuario = {
    nombre: '',
    correo: '',
    password: '',
    rol: 'Estudiante'
  };

  showPassword = false;

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
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
