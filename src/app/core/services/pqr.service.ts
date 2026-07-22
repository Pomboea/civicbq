import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Pqr, PqrStatus, PqrCategory, PqrComment } from '../models/pqr.model';
import { environment } from '../../../environments/environment';
import { environment } from '../../../environments/environment';

export interface StatsResponse {
  total: number;
  porEstado: Record<string, number>;
  porCategoria: Record<string, number>;
}

@Injectable({ providedIn: 'root' })
export class PqrService {
  private readonly API_URL = `${environment.apiUrl}/pqrs`;

  constructor(private http: HttpClient) {}

  getAll(filters?: { estado?: string; categoria?: string }): Observable<Pqr[]> {
    let params = new HttpParams();
    if (filters?.estado) params = params.set('estado', filters.estado);
    if (filters?.categoria) params = params.set('categoria', filters.categoria);
    return this.http.get<Pqr[]>(this.API_URL, { params });
  }

  getById(id: string): Observable<Pqr> {
    return this.http.get<Pqr>(`${this.API_URL}/${id}`);
  }

  getStats(): Observable<StatsResponse> {
    return this.http.get<StatsResponse>(`${this.API_URL}/stats`);
  }

  create(data: Omit<Pqr, 'id' | 'estado' | 'comentarios' | 'createdAt' | 'updatedAt' | 'creadoPor' | 'creadoPorNombre'>): Observable<Pqr> {
    return this.http.post<Pqr>(this.API_URL, data);
  }

  update(id: string, data: Partial<Pqr>): Observable<Pqr> {
    return this.http.put<Pqr>(`${this.API_URL}/${id}`, data);
  }

  changeStatus(id: string, estado: PqrStatus): Observable<Pqr> {
    return this.http.patch<Pqr>(`${this.API_URL}/${id}/status`, { estado });
  }

  addComment(pqrId: string, content: string): Observable<Pqr> {
    return this.http.post<Pqr>(`${this.API_URL}/${pqrId}/comments`, { content });
  }
}
