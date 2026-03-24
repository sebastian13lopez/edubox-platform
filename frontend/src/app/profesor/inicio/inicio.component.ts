import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Curso } from '../../models/models';

@Component({
  selector: 'app-profesor-inicio',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './inicio.component.html',
  styleUrls: ['./inicio.component.scss']
})
export class InicioComponent implements OnInit {

  cursosAsignados: any[] = [];
  isLoadingCursos = false;

  constructor(private router: Router) {}

  ngOnInit(): void {
    // TODO: inject DataService and call:
    // this.isLoadingCursos = true;
    // this.dataService.getCursosByProfesor().subscribe({
    //   next: data => this.cursosAsignados = data,
    //   complete: () => this.isLoadingCursos = false
    // });
  }

  iniciarClase(cursoColor: string): void {
    // Navega al aula en vivo al iniciar una clase
    this.router.navigate(['/profesor/aula-en-vivo']);
  }
}
