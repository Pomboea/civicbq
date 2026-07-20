import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { PqrService } from '../../../core/services/pqr.service';
import { AuthService } from '../../../core/services/auth.service';
import { AuthSession } from '../../../core/models/user.model';
import { Pqr, PqrStatus, ESTADOS_FLUJO } from '../../../core/models/pqr.model';

@Component({
  selector: 'app-pqr-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './pqr-detail.component.html',
  styleUrls: ['./pqr-detail.component.css']
})
export class PqrDetailComponent implements OnInit, OnDestroy {
  pqr: Pqr | null = null;
  session: AuthSession | null = null;
  newComment = '';
  selectedStatus: PqrStatus | '' = '';
  loading = false;
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private pqrService: PqrService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.session = this.authService.getSession();
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/pqr']);
      return;
    }

    this.pqrService.getById(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: pqr => {
          this.pqr = pqr;
          this.selectedStatus = pqr.estado as PqrStatus;
        },
        error: () => this.router.navigate(['/pqr'])
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get availableStatuses(): PqrStatus[] {
    if (!this.pqr) return [];
    return ESTADOS_FLUJO[this.pqr.estado as PqrStatus] || [];
  }

  get canChangeStatus(): boolean {
    if (!this.session || !this.pqr) return false;
    return ['operador', 'supervisor', 'admin'].includes(this.session.role) && this.availableStatuses.length > 0;
  }

  get canComment(): boolean {
    if (!this.session || !this.pqr) return false;
    return ['supervisor', 'admin'].includes(this.session.role);
  }

  get canEdit(): boolean {
    if (!this.session || !this.pqr) return false;
    if (this.session.role === 'admin') return true;
    if (this.session.role === 'ciudadano') return this.pqr.creadoPor === this.session.userId && this.pqr.estado === 'Recibida';
    return false;
  }

  changeStatus(): void {
    if (!this.pqr || !this.selectedStatus || this.selectedStatus === this.pqr.estado) return;
    this.loading = true;
    this.pqrService.changeStatus(this.pqr.id, this.selectedStatus as PqrStatus)
      .pipe(takeUntil(this.destroy$))
      .subscribe(pqr => {
        this.pqr = pqr;
        this.loading = false;
      });
  }

  addComment(): void {
    if (!this.pqr || !this.newComment.trim()) return;
    this.loading = true;
    this.pqrService.addComment(this.pqr.id, this.newComment.trim())
      .pipe(takeUntil(this.destroy$))
      .subscribe(pqr => {
        this.pqr = pqr;
        this.newComment = '';
        this.loading = false;
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

  getPriorityBadge(prioridad: string): string {
    const classes: Record<string, string> = {
      'Baja': 'bg-success',
      'Media': 'bg-warning text-dark',
      'Alta': 'bg-danger',
      'Urgente': 'bg-danger'
    };
    return classes[prioridad] || 'bg-secondary';
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
}
