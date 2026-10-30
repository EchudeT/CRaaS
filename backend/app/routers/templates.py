import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..catalog import business_name
from ..db import get_db
from ..models import Template
from ..services import topology as topo
from ..services.scene_data import check_scene, template_context

router = APIRouter(prefix="/api/templates", tags=["templates"])


class TemplateIn(BaseModel):
    name: str
    description: str = ""
    industry: str = "general"
    business: str = "pentest"
    topology: dict
    source: str = "rule-engine"


class TemplatePatch(BaseModel):
    name: str | None = None
    description: str | None = None
    industry: str | None = None
    business: str | None = None
    topology: dict | None = None


def serialize(t: Template) -> dict:
    return {
        **template_context(t),
        "id": t.id,
        "name": t.name,
        "description": t.description,
        "industry": t.industry,
        "business": t.business,
        "business_name": business_name(t.business),
        "zone_count": t.zone_count,
        "node_count": t.node_count,
        "source": t.source,
        "topology": t.topology,
        "created_at": t.created_at.isoformat(timespec="seconds"),
        "updated_at": t.updated_at.isoformat(timespec="seconds"),
    }


@router.get("")
def list_templates(q: str = "", business: str = "", industry: str = "", scene: str = "", db: Session = Depends(get_db)) -> dict:
    check_scene(scene)
    stmt = select(Template).order_by(Template.updated_at.desc())
    items = db.execute(stmt).scalars().all()
    if q:
        items = [t for t in items if q.lower() in t.name.lower() or q.lower() in t.description.lower()]
    if business:
        items = [t for t in items if t.business == business]
    if industry:
        items = [t for t in items if t.industry == industry]
    if scene:
        items = [t for t in items if template_context(t)["scene"] == scene]
    return {"items": [serialize(t) for t in items], "total": len(items)}


@router.post("")
def create_template(payload: TemplateIn, db: Session = Depends(get_db)) -> dict:
    scenario = payload.topology
    t = Template(
        id=f"tpl_{uuid.uuid4().hex[:10]}",
        name=payload.name,
        description=payload.description,
        industry=payload.industry,
        business=payload.business,
        zone_count=len(scenario.get("zones", [])),
        node_count=len(scenario.get("nodes", [])),
        source=payload.source,
        topology=scenario,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return serialize(t)


@router.get("/{template_id}")
def get_template(template_id: str, db: Session = Depends(get_db)) -> dict:
    t = db.get(Template, template_id)
    if not t:
        raise HTTPException(404, "模板不存在")
    return serialize(t)


@router.put("/{template_id}")
def update_template(template_id: str, payload: TemplatePatch, db: Session = Depends(get_db)) -> dict:
    t = db.get(Template, template_id)
    if not t:
        raise HTTPException(404, "模板不存在")
    if payload.name is not None:
        t.name = payload.name
    if payload.description is not None:
        t.description = payload.description
    if payload.industry is not None:
        t.industry = payload.industry
    if payload.business is not None:
        t.business = payload.business
    if payload.topology is not None:
        t.topology = payload.topology
        t.zone_count = len(payload.topology.get("zones", []))
        t.node_count = len(payload.topology.get("nodes", []))
    t.updated_at = datetime.now()
    db.commit()
    db.refresh(t)
    return serialize(t)


@router.delete("/{template_id}")
def delete_template(template_id: str, db: Session = Depends(get_db)) -> dict:
    t = db.get(Template, template_id)
    if not t:
        raise HTTPException(404, "模板不存在")
    db.delete(t)
    db.commit()
    return {"ok": True}


@router.get("/{template_id}/validate")
def validate_template(template_id: str, db: Session = Depends(get_db)) -> dict:
    t = db.get(Template, template_id)
    if not t:
        raise HTTPException(404, "模板不存在")
    return topo.validate_topology(t.topology)
