import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { User } from '../models/user.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly apiUrl = `${environment.apiUrl}/users`;
  private usersSubject = new BehaviorSubject<User[]>([]);

  constructor(private http: HttpClient) { this.refresh(); }

  private refresh(): void {
    this.http.get<User[]>(this.apiUrl)
      .subscribe({ next: users => this.usersSubject.next(users), error: () => {} });
  }

  getAll(): Observable<User[]> { return this.users$; }
  get users$() { return this.usersSubject.asObservable(); }

  toggleActive(id: string): Observable<User> {
    return this.http.patch<User>(`${this.apiUrl}/${id}/toggle-active`, {}).pipe(tap(() => this.refresh()));
  }

  resetPassword(id: string, newPassword: string): Observable<User> {
    return this.http.patch<User>(`${this.apiUrl}/${id}/reset-password`, { newPassword }).pipe(tap(() => this.refresh()));
  }
}