import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { AuthSession, UserRole } from '../models/user.model';
import { MOCK_USERS } from '../../mock/data';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly STORAGE_KEY = 'civicbq_session';
  private currentUserSubject = new BehaviorSubject<AuthSession | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor() {
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

  login(username: string, password: string): Observable<AuthSession | null> {
    const user = MOCK_USERS.find(
      u => u.username === username && u.password === password && u.activo
    );
    if (user) {
      const session: AuthSession = {
        userId: user.id,
        username: user.username,
        nombre: user.nombre,
        role: user.role,
        token: btoa(`${user.id}:${Date.now()}`)
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(session));
      this.currentUserSubject.next(session);
      return of(session);
    }
    return of(null);
  }

  register(data: { username: string; password: string; nombre: string; email: string }): Observable<AuthSession> {
    const exists = MOCK_USERS.find(u => u.username === data.username);
    if (exists) {
      return new Observable(observer => {
        observer.error({ status: 400, error: { detail: 'El nombre de usuario ya existe' } });
      });
    }
    const lastId = MOCK_USERS[MOCK_USERS.length - 1].id;
    const nextNum = parseInt(lastId.replace('U', '')) + 1;
    const newId = `U${String(nextNum).padStart(3, '0')}`;
    const newUser = {
      id: newId,
      username: data.username,
      password: data.password,
      nombre: data.nombre,
      email: data.email,
      role: 'ciudadano' as UserRole,
      activo: true
    };
    MOCK_USERS.push(newUser);
    const session: AuthSession = {
      userId: newUser.id,
      username: newUser.username,
      nombre: newUser.nombre,
      role: newUser.role,
      token: btoa(`${newUser.id}:${Date.now()}`)
    };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(session));
    this.currentUserSubject.next(session);
    return of(session);
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
