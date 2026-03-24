import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HistorialClase, ParticipationRecord } from '../../models/models';

@Component({
  selector: 'app-profesor-historial',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './historial.component.html',
  styleUrls: ['./historial.component.scss']
})
export class HistorialComponent implements OnInit {

  historialClases: any[]     = [];
  participacionClase: any[] = [];
  claseSeleccionadaReporte: any | null = null;
  isLoadingHistorial = false;

  ngOnInit(): void {
    // TODO: inject DataService
    // this.dataService.getHistorialClases().subscribe(d => this.historialClases = d);
  }

  verReporteDetalle(clase: any): void {
    this.claseSeleccionadaReporte = clase;
    // TODO: this.dataService.getParticipacion(clase.id!).subscribe(d => this.participacionClase = d);
  }

  cerrarReporteDetalle(): void {
    this.claseSeleccionadaReporte = null;
    this.participacionClase       = [];
  }
}
