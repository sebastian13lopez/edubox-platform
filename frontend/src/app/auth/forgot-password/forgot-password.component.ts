import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterModule],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.css']
})
export class ForgotPasswordComponent {
  correo = '';
  cargando = false;
  exito = false;
  errorMsg = '';

  constructor(private authService: AuthService) {}

  onSubmit() {
    this.cargando = true;
    this.errorMsg = '';

    this.authService.olvidePassword(this.correo).subscribe({
      next: (res) => {
        this.cargando = false;
        this.exito = true;
      },
      error: (err) => {
        this.cargando = false;
        this.errorMsg = err.error?.mensaje || 'Ocurrió un error. Inténtalo de nuevo.';
      }
    });
  }
}
