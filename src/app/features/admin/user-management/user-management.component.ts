import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { UserService } from '../../../core/services/user.service';
import { User, UserRole } from '../../../core/models/user.model';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.css']
})
export class UserManagementComponent implements OnInit, OnDestroy {
  users: User[] = [];
  private destroy$ = new Subject<void>();

  constructor(private userService: UserService) {}

  ngOnInit(): void {
    this.userService.getAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe(users => this.users = users);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleActive(user: User): void {
    this.userService.toggleActive(user.id).subscribe();
  }

  resetPassword(user: User): void {
    const newPassword = prompt(`Nueva contraseña para ${user.nombre}:`, 'temp123');
    if (newPassword && newPassword.trim()) {
      this.userService.resetPassword(user.id, newPassword.trim()).subscribe();
    }
  }

  getRoleBadgeClass(role: UserRole): string {
    const classes: Record<string, string> = {
      'admin': 'bg-danger',
      'supervisor': 'bg-warning text-dark',
      'operador': 'bg-info',
      'ciudadano': 'bg-secondary'
    };
    return classes[role] || 'bg-secondary';
  }
}
