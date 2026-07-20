export type UserRole = 'ciudadano' | 'operador' | 'supervisor' | 'admin';

export interface User {
  id: string;
  username: string;
  password: string;
  nombre: string;
  email: string;
  role: UserRole;
  activo: boolean;
}

export interface AuthSession {
  userId: string;
  username: string;
  nombre: string;
  role: UserRole;
  token: string;
}
