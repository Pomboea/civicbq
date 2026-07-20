import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';
import { PqrListComponent } from './pqr-list/pqr-list.component';
import { PqrFormComponent } from './pqr-form/pqr-form.component';
import { PqrDetailComponent } from './pqr-detail/pqr-detail.component';

export const PQR_ROUTES: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    children: [
      { path: '', component: PqrListComponent },
      { path: 'nueva', component: PqrFormComponent },
      { path: ':id', component: PqrDetailComponent },
      { path: ':id/editar', component: PqrFormComponent }
    ]
  }
];
