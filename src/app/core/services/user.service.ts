import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { User } from '../models/user.model';
import { MOCK_USERS } from '../../mock/data';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly STORAGE_KEY = 'civicbq_users';
  private usersSubject = new BehaviorSubject<User[]>([]);

  constructor() {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) { try { this.usersSubject.next(JSON.parse(stored)); return; } catch {} }
    this.usersSubject.next(MOCK_USERS); localStorage.setItem(this.STORAGE_KEY, JSON.stringify(MOCK_USERS));
  }

  getAll(): Observable<User[]> { return this.users$; }
  get users$() { return this.usersSubject.asObservable(); }

  toggleActive(id: string): Observable<User> {
    const c = this.usersSubject.value; const u = c.find(x => x.id === id); if (!u) throw new Error();
    u.activo = !u.activo; this.usersSubject.next([...c]); localStorage.setItem(this.STORAGE_KEY, JSON.stringify(c)); return of(u);
  }

  resetPassword(id: string, newPassword: string): Observable<User> {
    const c = this.usersSubject.value; const u = c.find(x => x.id === id); if (!u) throw new Error();
    u.password = newPassword; this.usersSubject.next([...c]); localStorage.setItem(this.STORAGE_KEY, JSON.stringify(c)); return of(u);
  }
}
