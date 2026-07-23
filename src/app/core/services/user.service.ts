import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { User } from '../models/user.model';
import { MOCK_USERS } from '../../mock/data';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly STORAGE_KEY = 'civicbq_users';
  private usersSubject = new BehaviorSubject<User[]>([]);
  public users$ = this.usersSubject.asObservable();

  constructor() {
    this.loadData();
  }

  private loadData(): void {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        this.usersSubject.next(JSON.parse(stored));
        return;
      } catch {
        localStorage.removeItem(this.STORAGE_KEY);
      }
    }
    this.usersSubject.next(MOCK_USERS);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(MOCK_USERS));
  }

  getAll(): Observable<User[]> {
    return this.users$;
  }

  toggleActive(id: string): Observable<User> {
    const current = this.usersSubject.value;
    const user = current.find(u => u.id === id);
    if (!user) throw new Error('Usuario no encontrado');
    user.activo = !user.activo;
    this.usersSubject.next([...current]);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(current));
    return of(user);
  }

  resetPassword(id: string, newPassword: string): Observable<User> {
    const current = this.usersSubject.value;
    const user = current.find(u => u.id === id);
    if (!user) throw new Error('Usuario no encontrado');
    user.password = newPassword;
    this.usersSubject.next([...current]);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(current));
    return of(user);
  }
}
