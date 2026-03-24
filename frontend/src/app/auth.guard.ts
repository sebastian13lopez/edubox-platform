import { inject } from '@angular/core';
import { CanActivateFn, CanActivateChildFn, Router } from '@angular/router';
import { AuthService } from './services/auth'; // Ensure this path matches the app.routes.ts relation

export const authGuard: CanActivateFn | CanActivateChildFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // 1. Verificar si está autenticado (existe token)
  if (!authService.estaAutenticado()) {
    router.navigate(['/login']);
    return false;
  }

  // 2. Obtener el rol y normalizarlo (las nuevas BD usan admin, profesor, estudiante)
  const rolBruto = authService.obtenerRol();
  if (!rolBruto) {
    authService.cerrarSesionLocal();
    router.navigate(['/login']);
    return false;
  }
  
  const rol = rolBruto.toLowerCase();

  // 3. Verificar acceso a rutas de Administrador
  if (state.url.startsWith('/admin') && rol !== 'admin' && rol !== 'administrador') {
    authService.cerrarSesionLocal();
    router.navigate(['/login']);
    return false;
  }

  // 4. Verificar acceso a rutas de Profesor
  if (state.url.startsWith('/profesor') && rol !== 'profesor') {
    // Si intenta entrar como profesor pero es estudiante o admin, lo regresamos a su inicio
    router.navigate([`/${rol}`]);
    return false;
  }

  // 5. Verificar acceso a rutas de Estudiante
  if (state.url.startsWith('/estudiante') && rol !== 'estudiante') {
    router.navigate([`/${rol}`]);
    return false;
  }

  // Si pasó todas las pruebas de su rol, lo dejamos entrar
  return true;
};
