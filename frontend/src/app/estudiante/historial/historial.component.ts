import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth';
import { HistorialParticipacion } from '../../models/models';

@Component({
  selector: 'app-estudiante-historial',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './historial.component.html',
  styleUrls: ['./historial.component.scss']
})
export class HistorialComponent implements OnInit {

  historialParticipacion: HistorialParticipacion[] = [];
  isLoading = false;

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    // TODO: inject DataService
    // const correo = this.authService.getCorreoUsuario();
    // this.dataService.getHistorialEstudiante(correo).subscribe(d => this.historialParticipacion = d);
  }
}
