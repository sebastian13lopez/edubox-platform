import { Routes } from '@angular/router';
import { Login } from './auth/login/login';
import { Register } from './auth/register/register';
import { authGuard } from './auth.guard';

export const routes: Routes = [
  { path: 'login',    component: Login },
  { path: 'register', component: Register },
  // ── Administrador (lazy-loaded shell + child routes) ───────────────
  {
    path: 'admin',
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    loadComponent: () =>
      import('./admin/admin-shell/admin-shell.component')
        .then(m => m.AdminShellComponent),
    children: [
      { path: '', redirectTo: 'cursos', pathMatch: 'full' },
      {
        path: 'cursos',
        loadComponent: () =>
          import('./admin/admin-cursos/admin-cursos.component').then(m => m.AdminCursosComponent)
      },
      {
        path: 'profesores',
        loadComponent: () =>
          import('./admin/admin-profesores/admin-profesores.component').then(m => m.AdminProfesoresComponent)
      },
      {
        path: 'reportes',
        loadComponent: () =>
          import('./admin/admin-reportes/admin-reportes.component').then(m => m.AdminReportesComponent)
      }
    ]
  },

  // ── Profesor (lazy-loaded shell + child routes) ──────────────────
  {
    path: 'profesor',
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    loadComponent: () =>
      import('./profesor/profesor-shell/profesor-shell.component')
        .then(m => m.ProfesorShellComponent),
    children: [
      { path: '',            redirectTo: 'inicio', pathMatch: 'full' },
      {
        path: 'inicio',
        loadComponent: () =>
          import('./profesor/inicio/inicio.component').then(m => m.InicioComponent)
      },
      {
        path: 'aula-en-vivo',
        loadComponent: () =>
          import('./profesor/aula-en-vivo/aula-en-vivo.component')
            .then(m => m.AulaEnVivoComponent)
      },
      {
        path: 'historial',
        loadComponent: () =>
          import('./profesor/historial/historial.component')
            .then(m => m.HistorialComponent)
      },
      {
        path: 'perfil',
        loadComponent: () =>
          import('./profesor/perfil/perfil.component').then(m => m.PerfilComponent)
      },
    ]
  },

  // ── Estudiante (lazy-loaded shell + child routes) ─────────────────
  {
    path: 'estudiante',
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    loadComponent: () =>
      import('./estudiante/estudiante-shell/estudiante-shell.component')
        .then(m => m.EstudianteShellComponent),
    children: [
      { path: '',            redirectTo: 'inicio', pathMatch: 'full' },
      {
        path: 'inicio',
        loadComponent: () =>
          import('./estudiante/inicio/inicio.component').then(m => m.InicioComponent)
      },
      {
        path: 'aula-en-vivo',
        loadComponent: () =>
          import('./estudiante/aula-en-vivo/aula-en-vivo.component')
            .then(m => m.AulaEnVivoComponent)
      },
      {
        path: 'historial',
        loadComponent: () =>
          import('./estudiante/historial/historial.component')
            .then(m => m.HistorialComponent)
      },
      {
        path: 'perfil',
        loadComponent: () =>
          import('./estudiante/perfil/perfil.component').then(m => m.PerfilComponent)
      },
    ]
  },

  // Backwards compatibility: old URLs redirect to new ones
  { path: 'professor-dashboard', redirectTo: '/profesor', pathMatch: 'full' },
  { path: 'student-dashboard',   redirectTo: '/estudiante', pathMatch: 'full' },

  { path: '', redirectTo: '/login', pathMatch: 'full' },
];