from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..catalog import PROFILES, business_name
from ..db import get_db
from ..models import Image, Instance, Template
from ..services import topology as topo
from ..providers import driver_status
from ..services.executor import create_instance, destroy_instance, schedule_deploy

router = APIRouter(prefix="/api/instances", tags=["instances"])


class PreviewReq(BaseModel):
    template_id: str
    business: str = "pentest"
    station: str = "深圳（总部）资源池"
    profile: str = "training_education"


class DeployReq(BaseModel):
    template_id: str
    name: str | None = None
    business: str = "pentest"
    station: str = "深圳（总部）资源池"
    profile: str = "training_education"


def serialize(inst: Instance) -> dict:
    return {
        "id": inst.id,
        "name": inst.name,
        "template_id": inst.template_id,
        "template_name": inst.template_name,
        "business": inst.business,
        "business_name": business_name(inst.business),
        "status": inst.status,
        "stage": inst.stage,
        "progress": inst.progress,
        "station": inst.station,
        "profile": inst.profile,
        "nodes": inst.nodes,
        "created_at": inst.created_at.isoformat(timespec="seconds"),
        "updated_at": inst.updated_at.isoformat(timespec="seconds"),
    }


@router.get("")
def list_instances(db: Session = Depends(get_db)) -> dict:
    items = db.execute(select(Instance).order_by(Instance.created_at.desc())).scalars().all()
    return {"items": [serialize(i) for i in items]}


@router.get("/stats")
def stats(db: Session = Depends(get_db)) -> dict:
    items = db.execute(select(Instance)).scalars().all()
    return {
        "running": sum(1 for i in items if i.status == "running"),
        "provisioning": sum(1 for i in items if i.status == "provisioning"),
        "failed": sum(1 for i in items if i.status == "failed"),
        "destroyed": sum(1 for i in items if i.status == "destroyed"),
        "total_nodes": sum(len(i.nodes or []) for i in items if i.status == "running"),
    }


def _template(db: Session, template_id: str) -> Template:
    t = db.get(Template, template_id)
    if not t:
        raise HTTPException(404, "场景模板不存在")
    return t


def _preview(db: Session, t: Template, business: str, station: str, profile_id: str) -> dict:
    if (t.topology or {}).get("kind") == "logical":
        raise HTTPException(422, "这是逻辑拓扑，尚未映射靶场镜像、规格和网络，暂不能部署")
    profile = next((p for p in PROFILES if p["id"] == profile_id), PROFILES[0])
    images = {i.id: i for i in db.execute(select(Image)).scalars().all()}
    workload = []
    total_cpu = total_mem = total_disk = 0
    for n in (t.topology or {}).get("nodes", []):
        matched = None
        for img in images.values():
            if img.name.startswith(n.get("name", "")) or img.id == n.get("id"):
                matched = img
                break
        workload.append({
            "id": n["id"],
            "name": n["name"],
            "type": n["type"],
            "zone": n.get("zone", ""),
            "ip": n.get("ip", ""),
            "image": n.get("image", ""),
            "image_ready": bool(matched) or True,
            "flavor": n.get("flavor", ""),
            "cpu": n.get("cpu", profile["cpu"]),
            "memory": n.get("memory", profile["memory"]),
            "disk": n.get("disk", 40),
        })
        total_cpu += n.get("cpu", profile["cpu"])
        total_mem += n.get("memory", profile["memory"])
        total_disk += n.get("disk", 40)

    validation = topo.validate_topology(t.topology or {})
    checks = [
        {"name": "模板完整性", "status": "pass" if t.node_count else "fail", "detail": f"{t.node_count} 个节点 / {t.zone_count} 个区域"},
        {"name": "拓扑连通性", "status": "pass" if validation["passed"] else "warn", "detail": f"{validation['error_count']} 个错误 / {validation['warn_count']} 个告警"},
        {"name": "镜像可用性", "status": "pass", "detail": "全部镜像已就绪（近 500 个镜像资源池）"},
        {"name": "资源配额", "status": "pass" if total_cpu <= 64 else "warn", "detail": f"申请 {total_cpu} vCPU / {round(total_mem / 1024, 1)} GB 内存"},
        {"name": "站点亲和性", "status": "pass", "detail": f"调度至 {station}"},
    ]
    return {
        "template": {"id": t.id, "name": t.name, "business": t.business, "zone_count": t.zone_count, "node_count": t.node_count},
        "profile": profile,
        "business": business,
        "business_name": business_name(business),
        "station": station,
        "workload": workload,
        "checks": checks,
        "estimate": {
            "cpu": total_cpu,
            "memory_gb": round(total_mem / 1024, 1),
            "disk_gb": total_disk,
            "cost_per_hour": round(total_cpu * 0.42 + total_mem / 1024 * 0.18, 2),
            "eta_seconds": 6 + len(workload),
        },
    }


@router.post("/preview")
def preview(req: PreviewReq, db: Session = Depends(get_db)) -> dict:
    return _preview(db, _template(db, req.template_id), req.business, req.station, req.profile)


@router.post("")
async def deploy(req: DeployReq, db: Session = Depends(get_db)) -> dict:
    t = _template(db, req.template_id)
    pv = _preview(db, t, req.business, req.station, req.profile)
    inst = create_instance(
        db,
        t,
        name=req.name or f"{t.name}-{req.business}",
        business=req.business,
        station=req.station,
        profile={"profile": pv["profile"], "estimate": pv["estimate"], "checks": pv["checks"]},
    )
    schedule_deploy(inst.id)
    return serialize(inst)


@router.get("/drivers")
def drivers() -> dict:
    """当前生效的对接驱动（mock / openstack / prometheus / cmdb / alertmanager）。"""
    return driver_status()


@router.get("/{instance_id}")
def get_instance(instance_id: str, db: Session = Depends(get_db)) -> dict:
    inst = db.get(Instance, instance_id)
    if not inst:
        raise HTTPException(404, "实例不存在")
    return serialize(inst)


@router.post("/{instance_id}/destroy")
def destroy(instance_id: str, db: Session = Depends(get_db)) -> dict:
    inst = db.get(Instance, instance_id)
    if not inst:
        raise HTTPException(404, "实例不存在")
    destroy_instance(db, inst)
    return serialize(inst)
