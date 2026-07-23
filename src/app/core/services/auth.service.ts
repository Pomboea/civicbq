import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { AuthSession, UserRole } from '../models/user.model';
import { environment } from '../../../environments/environment';

export interface LoginResponse {
  userId: string;
  username: string;
  nombre: string;
  role: string;
  token: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly API_URL = `${environment.apiUrl}/auth`;
  private readonly STORAGE_KEY = 'civicbq_session';
  private currentUserSubject = new BehaviorSubject<AuthSession | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadSession();
  }

  private loadSession(): void {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        this.currentUserSubject.next(JSON.parse(stored));
      } catch {
        localStorage.removeItem(this.STORAGE_KEY);
      }
    }
  }

  login(username: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.API_URL}/login`, { username, password }).pipe(
      tap(r => {
        const s: AuthSession = { userId: r.userId, username: r.username, nombre: r.nombre, role: r.role as UserRole, token: r.token };
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(s));
        this.currentUserSubject.next(s);
      })
    );
  }

  register(data: { username: string; password: string; nombre: string; email: string }): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.API_URL}/register`, data).pipe(
      tap(r => {
        const s: AuthSession = { userId: r.userId, username: r.username, nombre: r.nombre, role: r.role as UserRole, token: r.token };
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(s));
        this.currentUserSubject.next(s);
      })
    );
  }

  logout(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    this.currentUserSubject.next(null);
  }

  getSession(): AuthSession | null {
    return this.currentUserSubject.value;
  }

  isLoggedIn(): boolean {
    return this.currentUserSubject.value !== null;
  }

  hasRole(roles: UserRole[]): boolean {
    const s = this.getSession();
    return s !== null && roles.includes(s.role);
  }
}
