import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { PqrService } from '../../../core/services/pqr.service';
import { AuthService } from '../../../core/services/auth.service';
import { AuthSession } from '../../../core/models/user.model';
import { PQR_CATEGORIAS, PQR_PRIORIDADES } from '../../../core/models/pqr.model';

@Component({
  selector: 'app-pqr-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './pqr-form.component.html',
  styleUrls: ['./pqr-form.component.css']
})
export class PqrFormComponent implements OnInit {
  pqrForm: FormGroup;
  isEditMode = false;
  pqrId: string | null = null;
  session: AuthSession | null = null;
  loading = false;
  submitted = false;
  errorMessage = '';
  successMessage = '';
  categorias = PQR_CATEGORIAS;
  prioridades = PQR_PRIORIDADES;

  constructor(
    private fb: FormBuilder,
    private pqrService: PqrService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.pqrForm = this.fb.group({
      titulo: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(200)]],
      categoria: ['', Validators.required],
      descripcion: ['', [Validators.required, Validators.minLength(20), Validators.maxLength(2000)]],
      ubicacion: ['', [Validators.required, Validators.minLength(5)]],
      prioridad: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.session = this.authService.getSession();
    this.pqrId = this.route.snapshot.paramMap.get('id');

    if (this.pqrId) {
      this.isEditMode = true;
      this.pqrService.getById(this.pqrId).subscribe({
        next: pqr => {
          this.pqrForm.patchValue({
            titulo: pqr.titulo,
            categoria: pqr.categoria,
            descripcion: pqr.descripcion,
            ubicacion: pqr.ubicacion,
            prioridad: pqr.prioridad
          });
        },
        error: () => this.router.navigate(['/pqr'])
      });
    }
  }

  onSubmit(): void {
    this.submitted = true;
    if (this.pqrForm.invalid) return;

    this.loading = true;
    this.errorMessage = '';

    if (this.isEditMode && this.pqrId) {
      this.pqrService.update(this.pqrId, this.pqrForm.value).subscribe({
        next: () => {
          this.successMessage = 'PQR actualizada exitosamente';
          setTimeout(() => this.router.navigate(['/pqr', this.pqrId]), 1500);
        },
        error: () => {
          this.loading = false;
          this.errorMessage = 'Error al actualizar la PQR';
        }
      });
    } else {
      this.pqrService.create(this.pqrForm.value).subscribe({
        next: pqr => {
          this.successMessage = `PQR ${pqr.id} creada exitosamente`;
          setTimeout(() => this.router.navigate(['/pqr', pqr.id]), 1500);
        },
        error: () => {
          this.loading = false;
          this.errorMessage = 'Error al crear la PQR';
        }
      });
    }
  }

  get f() {
    return this.pqrForm.controls;
  }
}
