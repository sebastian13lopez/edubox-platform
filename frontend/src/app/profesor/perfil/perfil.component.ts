import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-profesor-perfil',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './perfil.component.html',
  styleUrls: ['./perfil.component.scss']
})
export class PerfilComponent implements OnInit {

  nombreProfesor = '';
  correoProfesor = '';

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.nombreProfesor = this.authService.getNombreUsuario();
    this.correoProfesor = this.authService.getCorreoUsuario();
  }
}
