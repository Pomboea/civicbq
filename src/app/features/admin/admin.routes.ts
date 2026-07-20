import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';
import { roleGuard } from '../../core/guards/role.guard';
import { UserManagementComponent } from './user-management/user-management.component';

export const ADMIN_ROUTES: Routes = [
  {
    path: 'usuarios',
    component: UserManagementComponent,
    canActivate: [authGuard, roleGuard(['admin'])]
  }
];
