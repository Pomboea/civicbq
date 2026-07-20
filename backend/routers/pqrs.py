from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db
from models import User, Pqr, Comment, PqrStatus as PqrStatusEnum, PqrCategory as PqrCategoryEnum, PqrPriority as PqrPriorityEnum
from schemas import (
    PqrResponse, PqrCreate, PqrUpdate, StatusChange,
    CommentCreate, CommentResponse, StatsResponse
)
from auth import get_current_user, require_roles
from typing import Optional

router = APIRouter(prefix="/api/pqrs", tags=["pqrs"])


def pqr_to_response(pqr: Pqr) -> PqrResponse:
    return PqrResponse(
        id=pqr.id,
        titulo=pqr.titulo,
        categoria=pqr.categoria.value if hasattr(pqr.categoria, 'value') else pqr.categoria,
        descripcion=pqr.descripcion,
        ubicacion=pqr.ubicacion,
        prioridad=pqr.prioridad.value if hasattr(pqr.prioridad, 'value') else pqr.prioridad,
        estado=pqr.estado.value if hasattr(pqr.estado, 'value') else pqr.estado,
        creadoPor=pqr.creado_por,
        creadoPorNombre=pqr.creado_por_nombre,
        asignadoA=pqr.asignado_a,
        asignadoANombre=pqr.asignado_a_nombre,
        comentarios=[
            CommentResponse(
                id=c.id,
                pqrId=c.pqr_id,
                userId=c.user_id,
                userName=c.user_name,
                content=c.content,
                createdAt=c.created_at
            )
            for c in pqr.comments
        ],
        createdAt=pqr.created_at,
        updatedAt=pqr.updated_at
    )


def str_to_enum(val: str, enum_cls: type) -> any:
    for e in enum_cls:
        if e.value == val:
            return e
    return val


@router.get("", response_model=list[PqrResponse])
def list_pqrs(
    estado: Optional[str] = Query(None),
    categoria: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Pqr)

    if current_user.role.value == "ciudadano":
        query = query.filter(Pqr.creado_por == current_user.id)

    if estado:
        query = query.filter(Pqr.estado == str_to_enum(estado, PqrStatusEnum))
    if categoria:
        query = query.filter(Pqr.categoria == str_to_enum(categoria, PqrCategoryEnum))

    pqrs = query.order_by(Pqr.created_at.desc()).all()
    return [pqr_to_response(p) for p in pqrs]


@router.get("/stats", response_model=StatsResponse)
def get_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Pqr)
    if current_user.role.value == "ciudadano":
        query = query.filter(Pqr.creado_por == current_user.id)

    pqrs = query.all()
    por_estado: dict[str, int] = {}
    por_categoria: dict[str, int] = {}

    for p in pqrs:
        estado = p.estado.value if hasattr(p.estado, 'value') else p.estado
        categoria = p.categoria.value if hasattr(p.categoria, 'value') else p.categoria
        por_estado[estado] = por_estado.get(estado, 0) + 1
        por_categoria[categoria] = por_categoria.get(categoria, 0) + 1

    return StatsResponse(total=len(pqrs), porEstado=por_estado, porCategoria=por_categoria)


@router.get("/{pqr_id}", response_model=PqrResponse)
def get_pqr(
    pqr_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    pqr = db.query(Pqr).filter(Pqr.id == pqr_id).first()
    if not pqr:
        raise HTTPException(status_code=404, detail="PQR no encontrada")

    if current_user.role.value == "ciudadano" and pqr.creado_por != current_user.id:
        raise HTTPException(status_code=403, detail="No tienes acceso a esta PQR")

    return pqr_to_response(pqr)


@router.post("", response_model=PqrResponse, status_code=201)
def create_pqr(
    data: PqrCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    last = db.query(Pqr).order_by(Pqr.id.desc()).first()
    next_num = 1
    if last:
        next_num = int(last.id.replace("PQR-", "")) + 1
    new_id = f"PQR-{str(next_num).zfill(3)}"

    pqr = Pqr(
        id=new_id,
        titulo=data.titulo,
        categoria=str_to_enum(data.categoria, PqrCategoryEnum),
        descripcion=data.descripcion,
        ubicacion=data.ubicacion,
        prioridad=str_to_enum(data.prioridad, PqrPriorityEnum),
        estado=PqrStatusEnum.Recibida,
        creado_por=current_user.id,
        creado_por_nombre=current_user.nombre
    )
    db.add(pqr)
    db.commit()
    db.refresh(pqr)
    return pqr_to_response(pqr)


@router.put("/{pqr_id}", response_model=PqrResponse)
def update_pqr(
    pqr_id: str,
    data: PqrUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    pqr = db.query(Pqr).filter(Pqr.id == pqr_id).first()
    if not pqr:
        raise HTTPException(status_code=404, detail="PQR no encontrada")

    if current_user.role.value == "ciudadano" and pqr.creado_por != current_user.id:
        raise HTTPException(status_code=403, detail="No tienes permiso para editar esta PQR")

    if data.titulo is not None:
        pqr.titulo = data.titulo
    if data.categoria is not None:
        pqr.categoria = str_to_enum(data.categoria, PqrCategoryEnum)
    if data.descripcion is not None:
        pqr.descripcion = data.descripcion
    if data.ubicacion is not None:
        pqr.ubicacion = data.ubicacion
    if data.prioridad is not None:
        pqr.prioridad = str_to_enum(data.prioridad, PqrPriorityEnum)

    db.commit()
    db.refresh(pqr)
    return pqr_to_response(pqr)


@router.patch("/{pqr_id}/status", response_model=PqrResponse)
def change_status(
    pqr_id: str,
    data: StatusChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["operador", "supervisor", "admin"]))
):
    pqr = db.query(Pqr).filter(Pqr.id == pqr_id).first()
    if not pqr:
        raise HTTPException(status_code=404, detail="PQR no encontrada")

    pqr.estado = str_to_enum(data.estado, PqrStatusEnum)
    db.commit()
    db.refresh(pqr)
    return pqr_to_response(pqr)


@router.post("/{pqr_id}/comments", response_model=PqrResponse)
def add_comment(
    pqr_id: str,
    data: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["supervisor", "admin"]))
):
    pqr = db.query(Pqr).filter(Pqr.id == pqr_id).first()
    if not pqr:
        raise HTTPException(status_code=404, detail="PQR no encontrada")

    last = db.query(Comment).order_by(Comment.id.desc()).first()
    next_num = 1
    if last:
        next_num = int(last.id.replace("C-", "")) + 1

    comment = Comment(
        id=f"C-{next_num}",
        pqr_id=pqr_id,
        user_id=current_user.id,
        user_name=current_user.nombre,
        content=data.content
    )
    db.add(comment)
    db.commit()
    db.refresh(pqr)
    return pqr_to_response(pqr)
