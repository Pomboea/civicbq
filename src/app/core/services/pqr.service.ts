import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { Pqr, PqrStatus, PqrCategory, PqrComment } from '../models/pqr.model';
import { MOCK_PQRS } from '../../mock/data';
import { AuthService } from './auth.service';

export interface StatsResponse {
  total: number;
  porEstado: Record<string, number>;
  porCategoria: Record<string, number>;
}

@Injectable({ providedIn: 'root' })
export class PqrService {
  private readonly STORAGE_KEY = 'civicbq_pqrs';
  private pqrsSubject = new BehaviorSubject<Pqr[]>([]);
  public pqrs$ = this.pqrsSubject.asObservable();

  constructor(private authService: AuthService) {
    this.loadData();
  }

  private loadData(): void {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        const pqrs: Pqr[] = JSON.parse(stored, (key, value) => {
          if (key === 'createdAt' || key === 'updatedAt') return new Date(value);
          if (key === 'comentarios') {
            return value.map((c: any) => ({ ...c, createdAt: new Date(c.createdAt) }));
          }
          return value;
        });
        this.pqrsSubject.next(pqrs);
        return;
      } catch {
        localStorage.removeItem(this.STORAGE_KEY);
      }
    }
    this.pqrsSubject.next(MOCK_PQRS);
    this.saveToStorage(MOCK_PQRS);
  }

  private saveToStorage(pqrs: Pqr[]): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(pqrs));
  }

  private getNextId(): string {
    const pqrs = this.pqrsSubject.value;
    const maxNum = pqrs.reduce((max, p) => {
      const num = parseInt(p.id.replace('PQR-', ''), 10);
      return num > max ? num : max;
    }, 0);
    return `PQR-${String(maxNum + 1).padStart(3, '0')}`;
  }

  getAll(): Observable<Pqr[]> {
    return this.pqrs$;
  }

  getById(id: string): Observable<Pqr> {
    return this.pqrs$.pipe(
      map(pqrs => {
        const pqr = pqrs.find(p => p.id === id);
        if (!pqr) throw new Error('PQR no encontrada');
        return pqr;
      })
    );
  }

  getStats(): Observable<StatsResponse> {
    return this.pqrs$.pipe(
      map(pqrs => {
        const porEstado: Record<string, number> = {};
        const porCategoria: Record<string, number> = {};
        pqrs.forEach(p => {
          porEstado[p.estado] = (porEstado[p.estado] || 0) + 1;
          porCategoria[p.categoria] = (porCategoria[p.categoria] || 0) + 1;
        });
        return { total: pqrs.length, porEstado, porCategoria };
      })
    );
  }

  create(data: Omit<Pqr, 'id' | 'estado' | 'comentarios' | 'createdAt' | 'updatedAt' | 'creadoPor' | 'creadoPorNombre'>): Observable<Pqr> {
    const session = this.authService.getSession();
    const newPqr: Pqr = {
      ...data,
      id: this.getNextId(),
      estado: 'Recibida',
      comentarios: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      creadoPor: session?.userId || '',
      creadoPorNombre: session?.nombre || ''
    };
    const current = this.pqrsSubject.value;
    const updated = [newPqr, ...current];
    this.pqrsSubject.next(updated);
    this.saveToStorage(updated);
    return of(newPqr);
  }

  update(id: string, changes: Partial<Pqr>): Observable<Pqr> {
    const current = this.pqrsSubject.value;
    const index = current.findIndex(p => p.id === id);
    if (index === -1) throw new Error('PQR no encontrada');
    const updatedPqr = { ...current[index], ...changes, updatedAt: new Date() };
    const updated = [...current];
    updated[index] = updatedPqr;
    this.pqrsSubject.next(updated);
    this.saveToStorage(updated);
    return of(updatedPqr);
  }

  changeStatus(id: string, estado: PqrStatus): Observable<Pqr> {
    return this.update(id, { estado });
  }

  addComment(pqrId: string, content: string): Observable<Pqr> {
    const session = this.authService.getSession();
    if (!session) throw new Error('No autenticado');
    const comment: PqrComment = {
      id: `C-${Date.now()}`,
      pqrId,
      userId: session.userId,
      userName: session.nombre,
      content,
      createdAt: new Date()
    };
    const current = this.pqrsSubject.value;
    const index = current.findIndex(p => p.id === pqrId);
    if (index === -1) throw new Error('PQR no encontrada');
    const updatedPqr = {
      ...current[index],
      comentarios: [...current[index].comentarios, comment],
      updatedAt: new Date()
    };
    const updated = [...current];
    updated[index] = updatedPqr;
    this.pqrsSubject.next(updated);
    this.saveToStorage(updated);
    return of(updatedPqr);
  }
}
