import type { Routes } from '@angular/router';
import { authGuard } from './core/auth/guards';

export const routes: Routes = [
  { path: '', redirectTo: 'auth', pathMatch: 'full' },
  {
    path: 'auth',
    loadChildren: () => import('./auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: 'kds',
    canActivate: [authGuard],
    loadChildren: () => import('./kds/kds.routes').then((m) => m.KDS_ROUTES),
  },
  { path: '**', redirectTo: 'auth' },
];
