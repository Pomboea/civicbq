import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { PqrService } from '../../../core/services/pqr.service';
import { AuthService } from '../../../core/services/auth.service';
import { AuthSession } from '../../../core/models/user.model';
import { Pqr, PQR_CATEGORIAS, PQR_ESTADOS } from '../../../core/models/pqr.model';

@Component({
  selector: 'app-pqr-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './pqr-list.component.html',
  styleUrls: ['./pqr-list.component.css']
})
export class PqrListComponent implements OnInit, OnDestroy {
  pqrs: Pqr[] = [];
  filteredPqrs: Pqr[] = [];
  session: AuthSession | null = null;
  filterStatus: string = '';
  filterCategory: string = '';
  searchTerm: string = '';
  categorias = PQR_CATEGORIAS;
  estados = PQR_ESTADOS;
  private destroy$ = new Subject<void>();

  constructor(
    private pqrService: PqrService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.session = this.authService.getSession();
    this.loadPqrs();
  }

  private loadPqrs(): void {
    this.pqrService.getAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe(pqrs => {
        this.pqrs = pqrs;
        this.applyFilters();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  applyFilters(): void {
    this.filteredPqrs = this.pqrs.filter(p => {
      const matchStatus = !this.filterStatus || p.estado === this.filterStatus;
      const matchCategory = !this.filterCategory || p.categoria === this.filterCategory;
      const matchSearch = !this.searchTerm ||
        p.titulo.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        p.id.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        p.descripcion.toLowerCase().includes(this.searchTerm.toLowerCase());
      return matchStatus && matchCategory && matchSearch;
    });
  }

  getEstadoClass(estado: string): string {
    const classes: Record<string, string> = {
      'Recibida': 'bg-secondary',
      'En revisión': 'bg-info',
      'En proceso': 'bg-primary',
      'Resuelta': 'bg-success',
      'Rechazada': 'bg-danger'
    };
    return classes[estado] || 'bg-secondary';
  }

  getPriorityClass(prioridad: string): string {
    const classes: Record<string, string> = {
      'Baja': 'text-success',
      'Media': 'text-warning',
      'Alta': 'text-danger',
      'Urgente': 'text-danger fw-bold'
    };
    return classes[prioridad] || '';
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

  canEdit(pqr: Pqr): boolean {
    if (!this.session) return false;
    if (this.session.role === 'admin') return true;
    if (this.session.role === 'ciudadano') return pqr.creadoPor === this.session.userId && pqr.estado === 'Recibida';
    return false;
  }
}
