import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-estudiante-perfil',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './perfil.component.html',
  styleUrls: ['./perfil.component.scss']
})
export class PerfilComponent implements OnInit {

  nombreEstudiante = '';
  correoEstudiante = '';

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.nombreEstudiante = this.authService.getNombreUsuario();
    this.correoEstudiante = this.authService.getCorreoUsuario();
  }
}
