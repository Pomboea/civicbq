import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { AuthSession } from '../../../core/models/user.model';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent implements OnInit {
  session: AuthSession | null = null;

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(s => this.session = s);
  }

  get isOperatorOrAbove(): boolean {
    return this.session !== null && ['operador', 'supervisor', 'admin'].includes(this.session.role);
  }

  get isAdmin(): boolean {
    return this.session?.role === 'admin';
  }
}
