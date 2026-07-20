import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { User } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly API_URL = 'http://localhost:8000/api/users';

  constructor(private http: HttpClient) {}

  getAll(): Observable<User[]> {
    return this.http.get<User[]>(this.API_URL);
  }

  toggleActive(id: string): Observable<User> {
    return this.http.patch<User>(`${this.API_URL}/${id}/toggle-active`, {});
  }

  resetPassword(id: string, newPassword: string): Observable<User> {
    return this.http.patch<User>(`${this.API_URL}/${id}/reset-password`, { newPassword });
  }
}
