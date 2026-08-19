import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, tap } from 'rxjs';
import { map } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { Pqr, PqrStatus, PqrComment } from '../models/pqr.model';
import { environment } from '../../../environments/environment';

export interface StatsResponse { total: number; porEstado: Record<string, number>; porCategoria: Record<string, number>; }

@Injectable({ providedIn: 'root' })
export class PqrService {
  private readonly apiUrl = `${environment.apiUrl}/pqrs`;
  private pqrsSubject = new BehaviorSubject<Pqr[]>([]);
  public pqrs$ = this.pqrsSubject.asObservable();

  constructor(private http: HttpClient) { this.refresh(); }

  refresh(): void {
    this.http.get<Pqr[]>(this.apiUrl)
      .pipe(map(list => list.map(p => this.toModel(p))))
      .subscribe({ next: pqrs => this.pqrsSubject.next(pqrs), error: () => {} });
  }

  private toModel(p: any): Pqr {
    return {
      ...p,
      createdAt: new Date(p.createdAt),
      updatedAt: new Date(p.updatedAt),
      comentarios: (p.comentarios || []).map((c: any): PqrComment => ({ ...c, createdAt: new Date(c.createdAt) }))
    };
  }

  getAll(): Observable<Pqr[]> { return this.pqrs$; }
  getById(id: string): Observable<Pqr> { return this.pqrs$.pipe(map(p => { const r = p.find(x => x.id === id); if (!r) throw new Error(); return r; })); }
  getStats(): Observable<StatsResponse> { return this.pqrs$.pipe(map(p => { const e: any = {}, c: any = {}; p.forEach(x => { e[x.estado] = (e[x.estado] || 0) + 1; c[x.categoria] = (c[x.categoria] || 0) + 1; }); return { total: p.length, porEstado: e, porCategoria: c }; })); }

  create(data: any): Observable<Pqr> {
    return this.http.post<Pqr>(this.apiUrl, data).pipe(tap(() => this.refresh()));
  }

  update(id: string, changes: any): Observable<Pqr> {
    return this.http.put<Pqr>(`${this.apiUrl}/${id}`, changes).pipe(tap(() => this.refresh()));
  }

  changeStatus(id: string, estado: PqrStatus): Observable<Pqr> {
    return this.http.patch<Pqr>(`${this.apiUrl}/${id}/status`, { estado }).pipe(tap(() => this.refresh()));
  }

  addComment(pqrId: string, content: string): Observable<Pqr> {
    return this.http.post<Pqr>(`${this.apiUrl}/${pqrId}/comments`, { content }).pipe(tap(() => this.refresh()));
  }
}