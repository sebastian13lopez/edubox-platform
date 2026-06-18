import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterModule],
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.css']
})
export class ResetPasswordComponent implements OnInit {
  token = '';
  nuevaPassword = '';
  confirmarPassword = '';
  showPassword = false;
  showConfirm = false;
  cargando = false;
  exito = false;
  errorMsg = '';

  constructor(
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    // Leer el token desde la URL: /reset-password?token=XYZ
    this.token = this.route.snapshot.queryParamMap.get('token') || '';
    if (!this.token) {
      this.errorMsg = 'El enlace de recuperación no es válido. Por favor solicita uno nuevo.';
    }
  }

  togglePassword() { this.showPassword = !this.showPassword; }
  toggleConfirm()  { this.showConfirm  = !this.showConfirm; }

  get passwordsNoCoinciden(): boolean {
    return !!this.confirmarPassword && this.nuevaPassword !== this.confirmarPassword;
  }

  onSubmit() {
    this.errorMsg = '';

    if (this.nuevaPassword !== this.confirmarPassword) {
      this.errorMsg = 'Las contraseñas no coinciden.';
      return;
    }
    if (this.nuevaPassword.length < 6) {
      this.errorMsg = 'La contraseña debe tener al menos 6 caracteres.';
      return;
    }

    this.cargando = true;

    this.authService.restablecerPassword(this.token, this.nuevaPassword).subscribe({
      next: () => {
        this.cargando = false;
        this.exito = true;
        // Redirigir al login tras 3 segundos
        setTimeout(() => this.router.navigate(['/login']), 3000);
      },
      error: (err) => {
        this.cargando = false;
        this.errorMsg = err.error?.mensaje || 'Ocurrió un error. Solicita un nuevo enlace.';
      }
    });
  }
}
