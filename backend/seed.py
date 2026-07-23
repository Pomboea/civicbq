import datetime
from database import SessionLocal, engine, Base
from models import User, Pqr, Comment, UserRole, PqrStatus, PqrCategory, PqrPriority
from auth import hash_password


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    if db.query(User).first():
        db.close()
        return

    users = [
        User(id="U001", username="admin", password=hash_password("admin123"), nombre="Carlos García", email="admin@civicbq.gov.co", role=UserRole.admin, activo=True),
        User(id="U002", username="supervisor", password=hash_password("sup123"), nombre="María López", email="supervisor@civicbq.gov.co", role=UserRole.supervisor, activo=True),
        User(id="U003", username="operador", password=hash_password("ope123"), nombre="Pedro Martínez", email="operador@civicbq.gov.co", role=UserRole.operador, activo=True),
        User(id="U004", username="ciudadano1", password=hash_password("ciu123"), nombre="Ana Rodríguez", email="ana@email.com", role=UserRole.ciudadano, activo=True),
        User(id="U005", username="ciudadano2", password=hash_password("ciu123"), nombre="Luis Hernández", email="luis@email.com", role=UserRole.ciudadano, activo=True),
    ]
    db.add_all(users)
    db.commit()

    pqrs = [
        Pqr(id="PQR-001", titulo="Bache en la calle principal", categoria=PqrCategory.Infraestructura, descripcion="Hay un bache grande en la carrera 5 con calle 10.", ubicacion="Cra 5 #10-30, Centro", prioridad=PqrPriority.Alta, estado=PqrStatus.En_proceso, creado_por="U004", creado_por_nombre="Ana Rodríguez", asignado_a="U003", asignado_a_nombre="Pedro Martínez", created_at=datetime.datetime(2026, 7, 5), updated_at=datetime.datetime(2026, 7, 10)),
        Pqr(id="PQR-002", titulo="Alumbrado público dañado", categoria=PqrCategory.Infraestructura, descripcion="Varios postes de luz no funcionan.", ubicacion="Barrio Las Flores", prioridad=PqrPriority.Media, estado=PqrStatus.Recibida, creado_por="U004", creado_por_nombre="Ana Rodríguez", created_at=datetime.datetime(2026, 7, 12), updated_at=datetime.datetime(2026, 7, 12)),
        Pqr(id="PQR-003", titulo="Robos frecuentes en el parque", categoria=PqrCategory.Seguridad, descripcion="Robos constantes en el parque central.", ubicacion="Parque Central", prioridad=PqrPriority.Urgente, estado=PqrStatus.En_revision, creado_por="U005", creado_por_nombre="Luis Hernández", asignado_a="U002", asignado_a_nombre="María López", created_at=datetime.datetime(2026, 7, 13), updated_at=datetime.datetime(2026, 7, 14)),
        Pqr(id="PQR-004", titulo="Falta de medicamentos en el hospital", categoria=PqrCategory.Salud, descripcion="Desabastecimiento de medicamentos.", ubicacion="Hospital Municipal", prioridad=PqrPriority.Urgente, estado=PqrStatus.En_proceso, creado_por="U005", creado_por_nombre="Luis Hernández", asignado_a="U003", asignado_a_nombre="Pedro Martínez", created_at=datetime.datetime(2026, 7, 14), updated_at=datetime.datetime(2026, 7, 15)),
        Pqr(id="PQR-005", titulo="Vertimiento de desechos en el río", categoria=PqrCategory.Medio_Ambiente, descripcion="Fábrica vertiendo desechos químicos.", ubicacion="Vereda El Porvenir", prioridad=PqrPriority.Alta, estado=PqrStatus.Resuelta, creado_por="U004", creado_por_nombre="Ana Rodríguez", asignado_a="U003", asignado_a_nombre="Pedro Martínez", created_at=datetime.datetime(2026, 7, 1), updated_at=datetime.datetime(2026, 7, 9)),
        Pqr(id="PQR-006", titulo="Semáforo dañado", categoria=PqrCategory.Transito, descripcion="Semáforo no funciona en intersección.", ubicacion="Av. Principal con Calle 50", prioridad=PqrPriority.Alta, estado=PqrStatus.En_revision, creado_por="U004", creado_por_nombre="Ana Rodríguez", asignado_a="U002", asignado_a_nombre="María López", created_at=datetime.datetime(2026, 7, 16), updated_at=datetime.datetime(2026, 7, 16)),
        Pqr(id="PQR-007", titulo="Recolección de basuras irregular", categoria=PqrCategory.Otros, descripcion="Carro de la basura no pasa.", ubicacion="Barrio San José", prioridad=PqrPriority.Media, estado=PqrStatus.Recibida, creado_por="U005", creado_por_nombre="Luis Hernández", created_at=datetime.datetime(2026, 7, 17), updated_at=datetime.datetime(2026, 7, 17)),
        Pqr(id="PQR-008", titulo="Construcción ilegal", categoria=PqrCategory.Infraestructura, descripcion="Edificio sin permiso en zona verde.", ubicacion="Barrio Los Pinos", prioridad=PqrPriority.Alta, estado=PqrStatus.En_proceso, creado_por="U005", creado_por_nombre="Luis Hernández", asignado_a="U003", asignado_a_nombre="Pedro Martínez", created_at=datetime.datetime(2026, 7, 15), updated_at=datetime.datetime(2026, 7, 16)),
        Pqr(id="PQR-009", titulo="Ruido excesivo en discoteca", categoria=PqrCategory.Seguridad, descripcion="Música a alto volumen después de las 11pm.", ubicacion="Zona Rosa", prioridad=PqrPriority.Media, estado=PqrStatus.Rechazada, creado_por="U004", creado_por_nombre="Ana Rodríguez", created_at=datetime.datetime(2026, 7, 10), updated_at=datetime.datetime(2026, 7, 11)),
        Pqr(id="PQR-010", titulo="Solicitud de poda de árboles", categoria=PqrCategory.Medio_Ambiente, descripcion="Árboles con ramas largas en el parque.", ubicacion="Barrio El Carmen", prioridad=PqrPriority.Baja, estado=PqrStatus.Recibida, creado_por="U004", creado_por_nombre="Ana Rodríguez", created_at=datetime.datetime(2026, 7, 18), updated_at=datetime.datetime(2026, 7, 18)),
    ]
    db.add_all(pqrs)
    db.commit()

    comments = [
        Comment(id="C-1", pqr_id="PQR-001", user_id="U003", user_name="Pedro Martínez", content="Se ha asignado cuadrilla de reparación.", created_at=datetime.datetime(2026, 7, 10)),
        Comment(id="C-2", pqr_id="PQR-003", user_id="U002", user_name="María López", content="Se contactó a la policía local. Incrementarán rondas.", created_at=datetime.datetime(2026, 7, 14)),
        Comment(id="C-3", pqr_id="PQR-004", user_id="U003", user_name="Pedro Martínez", content="Pedido de emergencia gestionado.", created_at=datetime.datetime(2026, 7, 15)),
        Comment(id="C-4", pqr_id="PQR-005", user_id="U003", user_name="Pedro Martínez", content="Fábrica sancionada. Vertimiento detenido.", created_at=datetime.datetime(2026, 7, 8)),
        Comment(id="C-5", pqr_id="PQR-005", user_id="U002", user_name="María López", content="Caso cerrado.", created_at=datetime.datetime(2026, 7, 9)),
        Comment(id="C-6", pqr_id="PQR-008", user_id="U003", user_name="Pedro Martínez", content="Se notificó a planeación municipal.", created_at=datetime.datetime(2026, 7, 16)),
        Comment(id="C-7", pqr_id="PQR-009", user_id="U002", user_name="María López", content="Establecimiento tiene permiso de ruido vigente.", created_at=datetime.datetime(2026, 7, 11)),
    ]
    db.add_all(comments)
    db.commit()
    db.close()
    print("Base de datos inicializada.")
