import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import ComputeNode, Image, NetworkResource, StorageResource, ResourceContext
from ..providers import driver_status, resource_provider
from ..services.scene_data import check_scene, contextualize, resource_context, validate_scene_ids
from ..services.extraction import CATALOG

router = APIRouter(prefix="/api/resources", tags=["resources"])


class ImageIn(BaseModel):
    scene_ids: list[str] = Field(default_factory=list)
    name: str
    category: str = "应用镜像"
    sub_category: str = "通用镜像"
    os_type: str = "Linux"
    size_gb: float = 20
    version: str = "v1.0"
    source: str = "通用镜像"
    arch: str = "x86_64"


class ComputeIn(BaseModel):
    scene_ids: list[str] = Field(default_factory=list)
    name: str
    node_type: str = "物理机"
    cluster: str = ""
    ip: str = ""
    port: int = 18000
    os_type: str = "Linux"
    pool: str = "计算资源"
    domain: str = "private"
    site: str = "深圳（总部）资源池"
    cpu_cores: int = 64
    memory_mb: int = 262144
    cpu_model: str = ""
    gpu_model: str = ""
    gpu_count: int = 0
    gpu_mem: int = 0
    raid: str = "RAID10"
    price_per_hour: float = 1.2
    api: str = ""


def img(t: Image) -> dict:
    return {
        "id": t.id,
        "name": t.name,
        "category": t.category,
        "sub_category": t.sub_category,
        "os_type": t.os_type,
        "size_gb": t.size_gb,
        "version": t.version,
        "source": t.source,
        "status": t.status,
        "arch": t.arch,
        "created_at": t.created_at.isoformat(timespec="seconds"),
    }


def compute(n: ComputeNode) -> dict:
    return {
        "id": n.id,
        "name": n.name,
        "node_type": n.node_type,
        "cluster": n.cluster,
        "ip": n.ip,
        "port": n.port,
        "os_type": n.os_type,
        "pool": n.pool,
        "domain": n.domain,
        "site": n.site,
        "cpu_cores": n.cpu_cores,
        "memory_mb": n.memory_mb,
        "cpu_model": n.cpu_model,
        "gpu_model": n.gpu_model,
        "gpu_count": n.gpu_count,
        "gpu_mem": n.gpu_mem,
        "raid": n.raid,
        "price_per_hour": n.price_per_hour,
        "status": n.status,
        "api": n.api,
        "created_at": n.created_at.isoformat(timespec="seconds"),
    }


def storage(s: StorageResource) -> dict:
    return {
        "id": s.id,
        "name": s.name,
        "storage_type": s.storage_type,
        "site": s.site,
        "capacity_tb": s.capacity_tb,
        "used_tb": s.used_tb,
        "usage": round(s.used_tb / s.capacity_tb * 100, 1) if s.capacity_tb else 0,
        "iops": s.iops,
        "protocol": s.protocol,
        "price_per_gb": s.price_per_gb,
        "status": s.status,
        "created_at": s.created_at.isoformat(timespec="seconds"),
    }


def network(n: NetworkResource) -> dict:
    return {
        "id": n.id,
        "name": n.name,
        "network_type": n.network_type,
        "cidr": n.cidr,
        "vlan": n.vlan,
        "bandwidth": n.bandwidth,
        "site": n.site,
        "used_ips": n.used_ips,
        "total_ips": n.total_ips,
        "status": n.status,
        "created_at": n.created_at.isoformat(timespec="seconds"),
    }


@router.get("/overview")
def overview(scene: str = "", db: Session = Depends(get_db)) -> dict:
    check_scene(scene)
    images = db.execute(select(Image)).scalars().all()
    comp = db.execute(select(ComputeNode)).scalars().all()
    stor = db.execute(select(StorageResource)).scalars().all()
    net = db.execute(select(NetworkResource)).scalars().all()
    images = contextualize(db, "image", images, img, scene)
    comp = contextualize(db, "compute", comp, compute, scene)
    stor = contextualize(db, "storage", stor, storage, scene)
    net = contextualize(db, "network", net, network, scene)
    entity_count = sum(len(s["entities"]) for sid, s in CATALOG["scenes"].items() if not scene or sid == scene)
    return {
        "cards": [
            {"id": "image", "name": "场景镜像", "count": len(images), "unit": "个", "desc": "已录入镜像（含明确标注的演示占位）", "real": len(images)},
            {"id": "device", "name": "实体类型目录", "count": entity_count, "unit": "类", "desc": "逻辑实体类型，不代表已部署设备", "real": entity_count},
            {"id": "compute", "name": "计算资源", "count": len(comp), "unit": "节点", "desc": "物理机 / 虚拟机 / GPU 节点统一纳管", "real": len(comp)},
            {"id": "storage", "name": "存储资源", "count": len(stor), "unit": "池", "desc": "分布式块存储 / 对象存储 / 共享文件存储", "real": len(stor)},
            {"id": "network", "name": "网络资源", "count": len(net), "unit": "网段", "desc": "VXLAN 虚拟网络、VLAN 隔离、专线通道", "real": len(net)},
        ],
        "industry_extra": [],
        "resources": {"image": images, "compute": comp, "storage": stor, "network": net},
        "demo_count": sum(r["is_demo"] for r in [*images, *comp, *stor, *net]),
    }


@router.get("/images")
def list_images(category: str = "", q: str = "", scene: str = "", db: Session = Depends(get_db)) -> dict:
    items = db.execute(select(Image).order_by(Image.created_at.desc())).scalars().all()
    if category and category != "全部":
        items = [i for i in items if i.category == category]
    if q:
        items = [i for i in items if q.lower() in i.name.lower()]
    return {
        "items": contextualize(db, "image", items, img, scene),
        "categories": ["全部", "操作系统", "应用镜像", "安全工具", "网络设备", "环境镜像", "容器镜像"],
    }


@router.post("/images")
def add_image(payload: ImageIn, db: Session = Depends(get_db)) -> dict:
    scene_ids = validate_scene_ids(payload.scene_ids)
    i = Image(
        id=f"img_{uuid.uuid4().hex[:8]}",
        name=payload.name,
        category=payload.category,
        sub_category=payload.sub_category,
        os_type=payload.os_type,
        size_gb=payload.size_gb,
        version=payload.version,
        source=payload.source,
        arch=payload.arch,
        status="可用",
        created_at=datetime.now(),
    )
    db.add(i)
    db.add(ResourceContext(kind="image", resource_id=i.id, scene_ids=scene_ids, data_origin="registered"))
    db.commit()
    db.refresh(i)
    return contextualize(db, "image", [i], img)[0]


@router.get("/compute")
def list_compute(scene: str = "", db: Session = Depends(get_db)) -> dict:
    items = db.execute(select(ComputeNode).order_by(ComputeNode.name)).scalars().all()
    rows = contextualize(db, "compute", items, compute, scene)
    return {
        "items": rows,
        "summary": {
            "total": len(rows),
            "online": sum(n["status"] == "在线" for n in rows),
            "schedulable": sum(n["status"] in ("在线", "运行中") for n in rows),
        },
    }


@router.post("/compute")
def add_compute(payload: ComputeIn, db: Session = Depends(get_db)) -> dict:
    scene_ids = validate_scene_ids(payload.scene_ids)
    n = ComputeNode(
        id=f"cmp_{uuid.uuid4().hex[:8]}",
        name=payload.name,
        node_type=payload.node_type,
        cluster=payload.cluster,
        ip=payload.ip,
        port=payload.port,
        os_type=payload.os_type,
        pool=payload.pool,
        domain=payload.domain,
        site=payload.site,
        cpu_cores=payload.cpu_cores,
        memory_mb=payload.memory_mb,
        cpu_model=payload.cpu_model,
        gpu_model=payload.gpu_model,
        gpu_count=payload.gpu_count,
        gpu_mem=payload.gpu_mem,
        raid=payload.raid,
        price_per_hour=payload.price_per_hour,
        api=payload.api,
        status="在线",
        created_at=datetime.now(),
    )
    db.add(n)
    db.add(ResourceContext(kind="compute", resource_id=n.id, scene_ids=scene_ids, data_origin="registered"))
    db.commit()
    db.refresh(n)
    return contextualize(db, "compute", [n], compute)[0]


@router.get("/storage")
def list_storage(scene: str = "", db: Session = Depends(get_db)) -> dict:
    items = db.execute(select(StorageResource).order_by(StorageResource.name)).scalars().all()
    return {"items": contextualize(db, "storage", items, storage, scene)}


@router.get("/network")
def list_network(scene: str = "", db: Session = Depends(get_db)) -> dict:
    items = db.execute(select(NetworkResource).order_by(NetworkResource.name)).scalars().all()
    return {"items": contextualize(db, "network", items, network, scene)}


class ContextIn(BaseModel):
    scene_ids: list[str]


@router.put("/{kind}/{resource_id}/context")
def assign_context(kind: str, resource_id: str, payload: ContextIn, db: Session = Depends(get_db)):
    """真实资源同步或录入后，复用同一场景关联；来源标记不能由此接口伪造。"""
    model = {"image": Image, "compute": ComputeNode, "storage": StorageResource, "network": NetworkResource}.get(kind)
    if model is None or db.get(model, resource_id) is None:
        raise HTTPException(404, "资源不存在")
    scene_ids = validate_scene_ids(payload.scene_ids)
    context = db.get(ResourceContext, (kind, resource_id))
    if context is None:
        context = ResourceContext(kind=kind, resource_id=resource_id, data_origin="registered")
        db.add(context)
    context.scene_ids = scene_ids
    db.commit()
    return resource_context(context)


# ------------------------------------------------------------ 资源同步（CMDB）
@router.get("/drivers")
def drivers() -> dict:
    return driver_status()


def _upsert(db: Session, model, rows: list[dict], prefix: str) -> int:
    """按名称覆盖写入，返回同步条数。"""
    count = 0
    kind = {Image: "image", ComputeNode: "compute", NetworkResource: "network", StorageResource: "storage"}[model]
    for row in rows:
        name = row.get("name")
        if not name:
            continue
        candidates = db.scalars(select(model).where(model.name == name)).all()
        obj = next((candidate for candidate in candidates
                    if not resource_context(db.get(ResourceContext, (kind, candidate.id)))["is_demo"]), None)
        values = {key: value for key, value in row.items() if key in model.__table__.columns and key not in ("id", "created_at")}
        if obj:
            for key, value in values.items():
                setattr(obj, key, value)
        else:
            obj = model(id=f"{prefix}_{uuid.uuid4().hex[:8]}", created_at=datetime.now(), **values)
            db.add(obj)
        context = db.get(ResourceContext, (kind, obj.id))
        if context:
            context.data_origin = "synced"
        else:
            db.add(ResourceContext(kind=kind, resource_id=obj.id, scene_ids=[], data_origin="synced"))
        db.flush()
        count += 1
    return count


@router.post("/sync")
def sync_resources(db: Session = Depends(get_db)) -> dict:
    """从 CMDB / 镜像仓库同步资源，幂等（按名称覆盖）。"""
    provider = resource_provider()
    name = getattr(provider, "name", "mock")
    if name == "mock":
        return {
            "provider": name,
            "created": 0,
            "message": "当前为 mock 驱动。配置 RESOURCE_DRIVER=cmdb 与 CMDB_URL 后即可从 CMDB / 镜像仓库同步。",
        }

    try:
        images = provider.images()
        compute_rows = provider.compute()
        networks = provider.networks()
        storages = provider.storages()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(502, f"CMDB 同步失败：{exc}") from exc

    result = {
        "provider": name,
        "images": _upsert(db, Image, images, "img"),
        "compute": _upsert(db, ComputeNode, compute_rows, "cmp"),
        "networks": _upsert(db, NetworkResource, networks, "net"),
        "storages": _upsert(db, StorageResource, storages, "sto"),
    }
    db.commit()
    result["message"] = "同步完成"
    return result
