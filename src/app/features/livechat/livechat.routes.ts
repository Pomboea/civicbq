import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';
import { roleGuard } from '../../core/guards/role.guard';
import { LiveChatComponent } from './livechat.component';

export const LIVECHAT_ROUTES: Routes = [
  { path: '', component: LiveChatComponent, canActivate: [authGuard, roleGuard(['operador', 'supervisor', 'admin'])] }
];
