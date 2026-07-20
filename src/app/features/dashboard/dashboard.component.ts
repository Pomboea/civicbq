import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { PqrService } from '../../core/services/pqr.service';
import { AuthService } from '../../core/services/auth.service';
import { AuthSession } from '../../core/models/user.model';
import { PQR_ESTADOS, PQR_CATEGORIAS } from '../../core/models/pqr.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  session: AuthSession | null = null;
  stats = { total: 0, porEstado: {} as Record<string, number>, porCategoria: {} as Record<string, number> };
  estados = PQR_ESTADOS;
  categorias = PQR_CATEGORIAS;
  private destroy$ = new Subject<void>();

  constructor(
    private pqrService: PqrService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.session = this.authService.getSession();
    this.pqrService.getStats()
      .pipe(takeUntil(this.destroy$))
      .subscribe(s => this.stats = s);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getEstadoClass(estado: string): string {
    const classes: Record<string, string> = {
      'Recibida': 'secondary',
      'En revisión': 'info',
      'En proceso': 'primary',
      'Resuelta': 'success',
      'Rechazada': 'danger'
    };
    return classes[estado] || 'secondary';
  }

  getCategoryIcon(categoria: string): string {
    const icons: Record<string, string> = {
      'Infraestructura': 'building',
      'Seguridad': 'shield-check',
      'Salud': 'heart-pulse',
      'Medio Ambiente': 'tree',
      'Tránsito': 'signpost-2',
      'Otros': 'archive'
    };
    return icons[categoria] || 'file-text';
  }

  getCategoryColor(categoria: string): string {
    const colors: Record<string, string> = {
      'Infraestructura': '#0d6efd',
      'Seguridad': '#dc3545',
      'Salud': '#198754',
      'Medio Ambiente': '#198754',
      'Tránsito': '#ffc107',
      'Otros': '#6c757d'
    };
    return colors[categoria] || '#6c757d';
  }
}
