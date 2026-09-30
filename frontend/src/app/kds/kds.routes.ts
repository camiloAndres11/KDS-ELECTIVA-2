import type { Routes } from '@angular/router';
import { roleGuard } from '../core/auth/guards';

export const KDS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./tablero-kds/tablero-kds.component').then((m) => m.TableroKdsComponent),
  },
  {
    path: 'pos',
    canActivate: [roleGuard(['POS_SYSTEM', 'ADMIN'])],
    loadComponent: () => import('./pos/pos.component').then((m) => m.PosComponent),
  },
];
