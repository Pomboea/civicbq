import { User } from '../core/models/user.model';
import { Pqr } from '../core/models/pqr.model';

export const MOCK_USERS: User[] = [
  {
    id: 'U001',
    username: 'admin',
    password: 'admin123',
    nombre: 'Carlos García',
    email: 'admin@civicbq.gov.co',
    role: 'admin',
    activo: true
  },
  {
    id: 'U002',
    username: 'supervisor',
    password: 'sup123',
    nombre: 'María López',
    email: 'supervisor@civicbq.gov.co',
    role: 'supervisor',
    activo: true
  },
  {
    id: 'U003',
    username: 'operador',
    password: 'ope123',
    nombre: 'Pedro Martínez',
    email: 'operador@civicbq.gov.co',
    role: 'operador',
    activo: true
  },
  {
    id: 'U004',
    username: 'ciudadano1',
    password: 'ciu123',
    nombre: 'Ana Rodríguez',
    email: 'ana@email.com',
    role: 'ciudadano',
    activo: true
  },
  {
    id: 'U005',
    username: 'ciudadano2',
    password: 'ciu123',
    nombre: 'Luis Hernández',
    email: 'luis@email.com',
    role: 'ciudadano',
    activo: true
  }
];

export const MOCK_PQRS: Pqr[] = [
  {
    id: 'PQR-001',
    titulo: 'Bache en la calle principal',
    categoria: 'Infraestructura',
    descripcion: 'Hay un bache grande en la carrera 5 con calle 10 que ha causado daños a varios vehículos. Solicito reparación urgente.',
    ubicacion: 'Cra 5 #10-30, Centro',
    prioridad: 'Alta',
    estado: 'En proceso',
    creadoPor: 'U004',
    creadoPorNombre: 'Ana Rodríguez',
    asignadoA: 'U003',
    asignadoANombre: 'Pedro Martínez',
    comentarios: [
      {
        id: 'C1',
        pqrId: 'PQR-001',
        userId: 'U003',
        userName: 'Pedro Martínez',
        content: 'Se ha asignado cuadrilla de reparación. Programado para esta semana.',
        createdAt: new Date('2026-07-10')
      }
    ],
    createdAt: new Date('2026-07-05'),
    updatedAt: new Date('2026-07-10')
  },
  {
    id: 'PQR-002',
    titulo: 'Alumbrado público dañado',
    categoria: 'Infraestructura',
    descripcion: 'Varios postes de luz en el barrio Las Flores no funcionan desde hace una semana. Oscuridad total en las noches.',
    ubicacion: 'Barrio Las Flores, Calle 20',
    prioridad: 'Media',
    estado: 'Recibida',
    creadoPor: 'U004',
    creadoPorNombre: 'Ana Rodríguez',
    comentarios: [],
    createdAt: new Date('2026-07-12'),
    updatedAt: new Date('2026-07-12')
  },
  {
    id: 'PQR-003',
    titulo: 'Robos frecuentes en el parque',
    categoria: 'Seguridad',
    descripcion: 'Los vecinos reportan robos constantes en el parque central durante la noche. Se necesita más vigilancia.',
    ubicacion: 'Parque Central, Zona Norte',
    prioridad: 'Urgente',
    estado: 'En revisión',
    creadoPor: 'U005',
    creadoPorNombre: 'Luis Hernández',
    asignadoA: 'U002',
    asignadoANombre: 'María López',
    comentarios: [
      {
        id: 'C2',
        pqrId: 'PQR-003',
        userId: 'U002',
        userName: 'María López',
        content: 'Se ha contactado a la policía local. Se incrementarán rondas nocturnas.',
        createdAt: new Date('2026-07-14')
      }
    ],
    createdAt: new Date('2026-07-13'),
    updatedAt: new Date('2026-07-14')
  },
  {
    id: 'PQR-004',
    titulo: 'Falta de medicamentos en el hospital',
    categoria: 'Salud',
    descripcion: 'El hospital municipal reporta desabastecimiento de medicamentos esenciales para pacientes crónicos.',
    ubicacion: 'Hospital Municipal, Cra 8 #15-20',
    prioridad: 'Urgente',
    estado: 'En proceso',
    creadoPor: 'U005',
    creadoPorNombre: 'Luis Hernández',
    asignadoA: 'U003',
    asignadoANombre: 'Pedro Martínez',
    comentarios: [
      {
        id: 'C3',
        pqrId: 'PQR-004',
        userId: 'U003',
        userName: 'Pedro Martínez',
        content: 'Se gestionó pedido de emergencia. Llegará en 48 horas.',
        createdAt: new Date('2026-07-15')
      }
    ],
    createdAt: new Date('2026-07-14'),
    updatedAt: new Date('2026-07-15')
  },
  {
    id: 'PQR-005',
    titulo: 'Vertimiento de desechos en el río',
    categoria: 'Medio Ambiente',
    descripcion: 'Una fábrica está vertiendo desechos químicos al río. El agua tiene mal olor y coloración verdosa.',
    ubicacion: 'Vereda El Porvenir, Río Grande',
    prioridad: 'Alta',
    estado: 'Resuelta',
    creadoPor: 'U004',
    creadoPorNombre: 'Ana Rodríguez',
    asignadoA: 'U003',
    asignadoANombre: 'Pedro Martínez',
    comentarios: [
      {
        id: 'C4',
        pqrId: 'PQR-005',
        userId: 'U003',
        userName: 'Pedro Martínez',
        content: 'Se realizó inspección. La fábrica fue sancionada y detuvo el vertimiento.',
        createdAt: new Date('2026-07-08')
      },
      {
        id: 'C5',
        pqrId: 'PQR-005',
        userId: 'U002',
        userName: 'María López',
        content: 'Se confirma cese de actividades contaminantes. Caso cerrado.',
        createdAt: new Date('2026-07-09')
      }
    ],
    createdAt: new Date('2026-07-01'),
    updatedAt: new Date('2026-07-09')
  },
  {
    id: 'PQR-006',
    titulo: 'Semáforo dañado en intersección peligrosa',
    categoria: 'Tránsito',
    descripcion: 'El semáforo de la avenida principal con calle 50 no funciona, causando caos vehicular en horas pico.',
    ubicacion: 'Av. Principal con Calle 50',
    prioridad: 'Alta',
    estado: 'En revisión',
    creadoPor: 'U004',
    creadoPorNombre: 'Ana Rodríguez',
    asignadoA: 'U002',
    asignadoANombre: 'María López',
    comentarios: [],
    createdAt: new Date('2026-07-16'),
    updatedAt: new Date('2026-07-16')
  },
  {
    id: 'PQR-007',
    titulo: 'Recolección de basuras irregular',
    categoria: 'Otros',
    descripcion: 'El carro de la basura no pasa desde hace 10 días en el barrio San José. Los residuos se acumulan.',
    ubicacion: 'Barrio San José, Calle 30',
    prioridad: 'Media',
    estado: 'Recibida',
    creadoPor: 'U005',
    creadoPorNombre: 'Luis Hernández',
    comentarios: [],
    createdAt: new Date('2026-07-17'),
    updatedAt: new Date('2026-07-17')
  },
  {
    id: 'PQR-008',
    titulo: 'Construcción ilegal en zona verde',
    categoria: 'Infraestructura',
    descripcion: 'Se está construyendo un edificio sin permiso en una zona verde del barrio Los Pinos.',
    ubicacion: 'Barrio Los Pinos, Manzana 3',
    prioridad: 'Alta',
    estado: 'En proceso',
    creadoPor: 'U005',
    creadoPorNombre: 'Luis Hernández',
    asignadoA: 'U003',
    asignadoANombre: 'Pedro Martínez',
    comentarios: [
      {
        id: 'C6',
        pqrId: 'PQR-008',
        userId: 'U003',
        userName: 'Pedro Martínez',
        content: 'Se notificó a planeación municipal. Se programó visita de inspección.',
        createdAt: new Date('2026-07-16')
      }
    ],
    createdAt: new Date('2026-07-15'),
    updatedAt: new Date('2026-07-16')
  },
  {
    id: 'PQR-009',
    titulo: 'Ruido excesivo en discoteca',
    categoria: 'Seguridad',
    descripcion: 'La discoteca del barrio emite música a alto volumen después de las 11pm, violando la norma de ruido.',
    ubicacion: 'Calle 12 #5-40, Zona Rosa',
    prioridad: 'Media',
    estado: 'Rechazada',
    creadoPor: 'U004',
    creadoPorNombre: 'Ana Rodríguez',
    comentarios: [
      {
        id: 'C7',
        pqrId: 'PQR-009',
        userId: 'U002',
        userName: 'María López',
        content: 'Se verificó y el establecimiento cuenta con permiso de ruido vigente. No procede la queja.',
        createdAt: new Date('2026-07-11')
      }
    ],
    createdAt: new Date('2026-07-10'),
    updatedAt: new Date('2026-07-11')
  },
  {
    id: 'PQR-010',
    titulo: 'Solicitud de poda de árboles',
    categoria: 'Medio Ambiente',
    descripcion: 'Los árboles del parque infantil tienen ramas muy largas que representan riesgo de caída.',
    ubicacion: 'Parque Infantil, Barrio El Carmen',
    prioridad: 'Baja',
    estado: 'Recibida',
    creadoPor: 'U004',
    creadoPorNombre: 'Ana Rodríguez',
    comentarios: [],
    createdAt: new Date('2026-07-18'),
    updatedAt: new Date('2026-07-18')
  }
];
