import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, catchError, of, tap } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { AuthSession, UserRole } from '../models/user.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly STORAGE_KEY = 'civicbq_session';
  private readonly apiUrl = `${environment.apiUrl}/auth`;
  private currentUserSubject = new BehaviorSubject<AuthSession | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) { this.loadSession(); }

  private loadSession(): void {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) { try { this.currentUserSubject.next(JSON.parse(stored)); } catch { localStorage.removeItem(this.STORAGE_KEY); } }
  }

  private storeSession(session: AuthSession): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(session));
    this.currentUserSubject.next(session);
  }

  login(username: string, password: string): Observable<AuthSession | null> {
    return this.http.post<AuthSession>(`${this.apiUrl}/login`, { username, password }).pipe(
      tap(session => this.storeSession(session)),
      catchError(() => of(null))
    );
  }

  register(data: { username: string; password: string; nombre: string; email: string }): Observable<AuthSession> {
    return this.http.post<AuthSession>(`${this.apiUrl}/register`, data).pipe(
      tap(session => this.storeSession(session))
    );
  }

  logout(): void { localStorage.removeItem(this.STORAGE_KEY); this.currentUserSubject.next(null); }
  getSession(): AuthSession | null { return this.currentUserSubject.value; }
  isLoggedIn(): boolean { return this.currentUserSubject.value !== null; }
  hasRole(roles: UserRole[]): boolean { const s = this.getSession(); return s !== null && roles.includes(s.role); }
}