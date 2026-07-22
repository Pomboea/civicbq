import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { AuthSession, UserRole } from '../models/user.model';
import { environment } from '../../../environments/environment';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  nombre: string;
  email: string;
}

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
        const session: AuthSession = JSON.parse(stored);
        this.currentUserSubject.next(session);
      } catch {
        localStorage.removeItem(this.STORAGE_KEY);
      }
    }
  }

  login(username: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.API_URL}/login`, { username, password }).pipe(
      tap(response => {
        const session: AuthSession = {
          userId: response.userId,
          username: response.username,
          nombre: response.nombre,
          role: response.role as UserRole,
          token: response.token
        };
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(session));
        this.currentUserSubject.next(session);
      })
    );
  }

  register(data: RegisterRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.API_URL}/register`, data).pipe(
      tap(response => {
        const session: AuthSession = {
          userId: response.userId,
          username: response.username,
          nombre: response.nombre,
          role: response.role as UserRole,
          token: response.token
        };
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(session));
        this.currentUserSubject.next(session);
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
    const session = this.getSession();
    return session !== null && roles.includes(session.role);
  }
}
