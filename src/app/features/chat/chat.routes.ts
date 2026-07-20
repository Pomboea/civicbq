import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';
import { ChatComponent } from './chat.component';

export const CHAT_ROUTES: Routes = [
  { path: '', component: ChatComponent, canActivate: [authGuard] }
];
