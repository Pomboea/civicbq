import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { Pqr, PqrStatus, PqrComment } from '../models/pqr.model';
import { MOCK_PQRS } from '../../mock/data';
import { AuthService } from './auth.service';

export interface StatsResponse { total: number; porEstado: Record<string, number>; porCategoria: Record<string, number>; }

@Injectable({ providedIn: 'root' })
export class PqrService {
  private readonly STORAGE_KEY = 'civicbq_pqrs';
  private pqrsSubject = new BehaviorSubject<Pqr[]>([]);
  public pqrs$ = this.pqrsSubject.asObservable();

  constructor(private authService: AuthService) {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) { try { this.pqrsSubject.next(JSON.parse(stored, (k, v) => (k === 'createdAt' || k === 'updatedAt') ? new Date(v) : v)); return; } catch {} }
    this.pqrsSubject.next(MOCK_PQRS); localStorage.setItem(this.STORAGE_KEY, JSON.stringify(MOCK_PQRS));
  }

  private getNextId(): string {
    const pqrs = this.pqrsSubject.value;
    const max = pqrs.reduce((m, p) => Math.max(m, parseInt(p.id.replace('PQR-', ''), 10)), 0);
    return `PQR-${String(max + 1).padStart(3, '0')}`;
  }

  getAll(): Observable<Pqr[]> { return this.pqrs$; }
  getById(id: string): Observable<Pqr> { return this.pqrs$.pipe(map(p => { const r = p.find(x => x.id === id); if (!r) throw new Error(); return r; })); }
  getStats(): Observable<StatsResponse> { return this.pqrs$.pipe(map(p => { const e: any = {}, c: any = {}; p.forEach(x => { e[x.estado] = (e[x.estado] || 0) + 1; c[x.categoria] = (c[x.categoria] || 0) + 1; }); return { total: p.length, porEstado: e, porCategoria: c }; })); }

  create(data: any): Observable<Pqr> {
    const s = this.authService.getSession();
    const pqr: Pqr = { ...data, id: this.getNextId(), estado: 'Recibida', comentarios: [], createdAt: new Date(), updatedAt: new Date(), creadoPor: s?.userId || '', creadoPorNombre: s?.nombre || '' };
    const u = [pqr, ...this.pqrsSubject.value]; this.pqrsSubject.next(u); localStorage.setItem(this.STORAGE_KEY, JSON.stringify(u)); return of(pqr);
  }

  update(id: string, changes: any): Observable<Pqr> {
    const c = this.pqrsSubject.value; const i = c.findIndex(p => p.id === id);
    const u = [...c]; u[i] = { ...u[i], ...changes, updatedAt: new Date() }; this.pqrsSubject.next(u); localStorage.setItem(this.STORAGE_KEY, JSON.stringify(u)); return of(u[i]);
  }

  changeStatus(id: string, estado: PqrStatus): Observable<Pqr> { return this.update(id, { estado }); }

  addComment(pqrId: string, content: string): Observable<Pqr> {
    const s = this.authService.getSession(); if (!s) throw new Error();
    return this.update(pqrId, { comentarios: [...(this.pqrsSubject.value.find(p => p.id === pqrId)?.comentarios || []), { id: `C-${Date.now()}`, pqrId, userId: s.userId, userName: s.nombre, content, createdAt: new Date() }] });
  }
}
