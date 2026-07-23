from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db
from models import User, Pqr, Comment, PqrStatus, PqrCategory, PqrPriority
from schemas import PqrResponse, PqrCreate, PqrUpdate, StatusChange, CommentCreate, CommentResponse, StatsResponse
from auth import get_current_user, require_roles
from typing import Optional

router = APIRouter()


def to_enum(val: str, cls: type):
    for e in cls:
        if e.value == val:
            return e
    return val


def pqr_to_response(p: Pqr) -> PqrResponse:
    return PqrResponse(
        id=p.id, titulo=p.titulo, categoria=p.categoria.value, descripcion=p.descripcion,
        ubicacion=p.ubicacion, prioridad=p.prioridad.value, estado=p.estado.value,
        creadoPor=p.creado_por, creadoPorNombre=p.creado_por_nombre,
        asignadoA=p.asignado_a, asignadoANombre=p.asignado_a_nombre,
        comentarios=[CommentResponse(id=c.id, pqrId=c.pqr_id, userId=c.user_id, userName=c.user_name,
                                     content=c.content, createdAt=c.created_at) for c in p.comments],
        createdAt=p.created_at, updatedAt=p.updated_at
    )


@router.get("", response_model=list[PqrResponse])
def list_pqrs(estado: Optional[str] = Query(None), categoria: Optional[str] = Query(None),
              db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(Pqr)
    if current_user.role.value == "ciudadano":
        query = query.filter(Pqr.creado_por == current_user.id)
    if estado:
        query = query.filter(Pqr.estado == to_enum(estado, PqrStatus))
    if categoria:
        query = query.filter(Pqr.categoria == to_enum(categoria, PqrCategory))
    return [pqr_to_response(p) for p in query.order_by(Pqr.created_at.desc()).all()]


@router.get("/stats", response_model=StatsResponse)
def get_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(Pqr)
    if current_user.role.value == "ciudadano":
        query = query.filter(Pqr.creado_por == current_user.id)
    pqrs = query.all()
    s, c = {}, {}
    for p in pqrs:
        s[p.estado.value] = s.get(p.estado.value, 0) + 1
        c[p.categoria.value] = c.get(p.categoria.value, 0) + 1
    return StatsResponse(total=len(pqrs), porEstado=s, porCategoria=c)


@router.get("/{pqr_id}", response_model=PqrResponse)
def get_pqr(pqr_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pqr = db.query(Pqr).filter(Pqr.id == pqr_id).first()
    if not pqr:
        raise HTTPException(status_code=404, detail="PQR no encontrada")
    if current_user.role.value == "ciudadano" and pqr.creado_por != current_user.id:
        raise HTTPException(status_code=403, detail="No tienes acceso a esta PQR")
    return pqr_to_response(pqr)


@router.post("", response_model=PqrResponse, status_code=201)
def create_pqr(data: PqrCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    last = db.query(Pqr).order_by(Pqr.id.desc()).first()
    next_num = int(last.id.replace("PQR-", "")) + 1 if last else 1
    pqr = Pqr(id=f"PQR-{str(next_num).zfill(3)}", titulo=data.titulo,
              categoria=to_enum(data.categoria, PqrCategory), descripcion=data.descripcion,
              ubicacion=data.ubicacion, prioridad=to_enum(data.prioridad, PqrPriority),
              estado=PqrStatus.Recibida, creado_por=current_user.id, creado_por_nombre=current_user.nombre)
    db.add(pqr)
    db.commit()
    db.refresh(pqr)
    return pqr_to_response(pqr)


@router.put("/{pqr_id}", response_model=PqrResponse)
def update_pqr(pqr_id: str, data: PqrUpdate, db: Session = Depends(get_db),
               current_user: User = Depends(get_current_user)):
    pqr = db.query(Pqr).filter(Pqr.id == pqr_id).first()
    if not pqr:
        raise HTTPException(status_code=404, detail="PQR no encontrada")
    if current_user.role.value == "ciudadano" and pqr.creado_por != current_user.id:
        raise HTTPException(status_code=403, detail="No tienes permiso para editar esta PQR")
    if data.titulo is not None:
        pqr.titulo = data.titulo
    if data.categoria is not None:
        pqr.categoria = to_enum(data.categoria, PqrCategory)
    if data.descripcion is not None:
        pqr.descripcion = data.descripcion
    if data.ubicacion is not None:
        pqr.ubicacion = data.ubicacion
    if data.prioridad is not None:
        pqr.prioridad = to_enum(data.prioridad, PqrPriority)
    db.commit()
    db.refresh(pqr)
    return pqr_to_response(pqr)


@router.patch("/{pqr_id}/status", response_model=PqrResponse)
def change_status(pqr_id: str, data: StatusChange, db: Session = Depends(get_db),
                  current_user: User = Depends(require_roles(["operador", "supervisor", "admin"]))):
    pqr = db.query(Pqr).filter(Pqr.id == pqr_id).first()
    if not pqr:
        raise HTTPException(status_code=404, detail="PQR no encontrada")
    pqr.estado = to_enum(data.estado, PqrStatus)
    db.commit()
    db.refresh(pqr)
    return pqr_to_response(pqr)


@router.post("/{pqr_id}/comments", response_model=PqrResponse)
def add_comment(pqr_id: str, data: CommentCreate, db: Session = Depends(get_db),
                current_user: User = Depends(require_roles(["supervisor", "admin"]))):
    pqr = db.query(Pqr).filter(Pqr.id == pqr_id).first()
    if not pqr:
        raise HTTPException(status_code=404, detail="PQR no encontrada")
    last = db.query(Comment).order_by(Comment.id.desc()).first()
    next_num = int(last.id.replace("C-", "")) + 1 if last else 1
    db.add(Comment(id=f"C-{next_num}", pqr_id=pqr_id, user_id=current_user.id,
                   user_name=current_user.nombre, content=data.content))
    db.commit()
    db.refresh(pqr)
    return pqr_to_response(pqr)
