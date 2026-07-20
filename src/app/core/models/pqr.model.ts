export type PqrCategory = 'Infraestructura' | 'Seguridad' | 'Salud' | 'Medio Ambiente' | 'Tránsito' | 'Otros';
export type PqrStatus = 'Recibida' | 'En revisión' | 'En proceso' | 'Resuelta' | 'Rechazada';
export type PqrPriority = 'Baja' | 'Media' | 'Alta' | 'Urgente';

export interface PqrComment {
  id: string;
  pqrId: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: Date;
}

export interface Pqr {
  id: string;
  titulo: string;
  categoria: PqrCategory;
  descripcion: string;
  ubicacion: string;
  prioridad: PqrPriority;
  estado: PqrStatus;
  creadoPor: string;
  creadoPorNombre: string;
  asignadoA?: string;
  asignadoANombre?: string;
  comentarios: PqrComment[];
  createdAt: Date;
  updatedAt: Date;
}

export const PQR_CATEGORIAS: PqrCategory[] = [
  'Infraestructura', 'Seguridad', 'Salud', 'Medio Ambiente', 'Tránsito', 'Otros'
];

export const PQR_ESTADOS: PqrStatus[] = [
  'Recibida', 'En revisión', 'En proceso', 'Resuelta', 'Rechazada'
];

export const PQR_PRIORIDADES: PqrPriority[] = [
  'Baja', 'Media', 'Alta', 'Urgente'
];

export const ESTADOS_FLUJO: Record<PqrStatus, PqrStatus[]> = {
  'Recibida': ['En revisión', 'Rechazada'],
  'En revisión': ['En proceso', 'Rechazada'],
  'En proceso': ['Resuelta', 'Rechazada'],
  'Resuelta': [],
  'Rechazada': []
};
