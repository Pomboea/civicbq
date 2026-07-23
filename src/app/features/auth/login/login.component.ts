import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  loginForm: FormGroup;
  errorMessage = '';
  loading = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      password: ['', [Validators.required, Validators.minLength(4)]]
    });
  }

  onSubmit(): void {
    if (this.loginForm.invalid) return;

    this.loading = true;
    this.errorMessage = '';
    const { username, password } = this.loginForm.value;

    this.authService.login(username, password).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/dashboard']);
      },
      error: err => {
        this.loading = false;
        this.errorMessage = err.status === 401
          ? 'Credenciales inválidas. Verifica tu usuario y contraseña.'
          : 'Error de conexión con el servidor.';
      }
    });
  }

  quickLogin(role: string): void {
    const credentials: Record<string, { username: string; password: string }> = {
      admin: { username: 'admin', password: 'admin123' },
      supervisor: { username: 'supervisor', password: 'sup123' },
      operador: { username: 'operador', password: 'ope123' },
      ciudadano: { username: 'ciudadano1', password: 'ciu123' }
    };
    const cred = credentials[role];
    if (cred) {
      this.loginForm.patchValue(cred);
      this.onSubmit();
    }
  }
}
