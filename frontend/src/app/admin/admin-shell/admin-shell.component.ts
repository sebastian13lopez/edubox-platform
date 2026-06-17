import { environment } from '@env/environment';
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-shell.component.html',
  styles: []
})
export class AdminShellComponent implements OnInit {
  cursosCount: number = 0;

  constructor(private router: Router, private http: HttpClient) {}

  ngOnInit() {
    this.http.get<any[]>(environment.apiUrl + '/cursos').subscribe({
      next: (data: any[]) => this.cursosCount = data.length,
      error: (err: any) => this.cursosCount = 0
    });
  }

  cerrarSesion() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuarioId');
    localStorage.removeItem('rol');
    this.router.navigate(['/login']);
  }
}
