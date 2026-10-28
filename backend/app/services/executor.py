"""实例编排执行器。

把场景模板实例化：交给 ComputeProvider 创建资源（mock 驱动走本地状态机，
openstack 驱动创建真实虚机），再轮询回填状态、真实 IP 与端口。
"""

from __future__ import annotations

import asyncio
import logging
import random
import time
import uuid

from sqlalchemy import select

from .. import config
from ..db import SessionLocal
from ..models import Instance, Template
from ..providers import DeploySpec, NodeSpec, compute_provider

log = logging.getLogger("craas.executor")
_bg_tasks: set[asyncio.Task] = set()

POLL_INTERVAL = 1.2
STAGES = ["资源申请", "镜像分发", "网络编排", "实例启动", "就绪"]

USERS = [("root", "Craas@2026"), ("admin", "Admin@123"), ("kali", "Kali@123")]


def _port(seed: str, base: int = 20000) -> int:
    rnd = random.Random(seed)
    return base + rnd.randint(1, 900)


def build_instance_nodes(topology: dict) -> list[dict]:
    out = []
    for i, n in enumerate(topology.get("nodes", [])):
        user, pwd = USERS[i % len(USERS)]
        out.append({
            "id": n["id"],
            "name": n["name"],
            "type": n["type"],
            "zone": n.get("zone", ""),
            "ip": n.get("ip", "—"),
            "image": n.get("image", ""),
            "flavor": n.get("flavor", ""),
            "cpu": n.get("cpu", 2),
            "memory": n.get("memory", 4096),
            "disk": n.get("disk", 40),
            "status": "provisioning",
            "ssh_port": 0 if n["type"] == "cloud" else _port(n["id"]),
            "username": user if n["type"] in ("server", "pc", "kali", "plc") else "admin",
            "password": pwd,
        })
    return out


# --------------------------------------------------------------- provider 适配
def _spec(inst: Instance) -> DeploySpec:
    nodes = []
    for n in inst.nodes or []:
        if n.get("type") == "cloud":  # 互联网出口不是可创建资源
            continue
        nodes.append(NodeSpec(
            id=n["id"],
            name=n["name"],
            type=n["type"],
            zone=n.get("zone", ""),
            image=n.get("image", ""),
            flavor=n.get("flavor", ""),
            cpu=n.get("cpu", 2),
            memory=n.get("memory", 4096),
            disk=n.get("disk", 40),
            ip=n.get("ip", ""),
        ))
    return DeploySpec(
        instance_id=inst.id,
        name=inst.name,
        station=inst.station,
        business=inst.business,
        nodes=nodes,
    )


def _apply_state(inst: Instance, status: str, progress: int, stage: str, patch_nodes: list[dict]) -> None:
    inst.status = status
    inst.progress = progress
    inst.stage = stage
    if patch_nodes:
        by_id = {p.get("id"): p for p in patch_nodes if p.get("id")}
        merged = []
        for n in inst.nodes or []:
            p = by_id.get(n["id"])
            merged.append({**n, **p} if p else n)
        inst.nodes = merged


async def _run(instance_id: str) -> None:
    provider = compute_provider()
    db = SessionLocal()
    try:
        inst = db.get(Instance, instance_id)
        if not inst:
            return

        spec = _spec(inst)
        profile = dict(inst.profile or {})
        handle = profile.get("handle")

        if not handle:
            try:
                handle, state = await asyncio.to_thread(provider.deploy, spec)
            except Exception as exc:  # noqa: BLE001
                log.exception("部署失败 instance=%s", instance_id)
                inst.status = "failed"
                inst.stage = f"部署失败：{exc}"[:120]
                inst.progress = 100
                db.commit()
                return
            profile["handle"] = handle
            profile["driver"] = getattr(provider, "name", "mock")
            inst.profile = profile
            _apply_state(inst, state.status, state.progress, state.stage, state.nodes)
            db.commit()

        deadline = time.time() + config.COMPUTE_TIMEOUT
        while time.time() < deadline:
            await asyncio.sleep(POLL_INTERVAL)
            try:
                state = await asyncio.to_thread(provider.poll, handle, spec)
            except Exception as exc:  # noqa: BLE001
                log.exception("轮询失败 instance=%s", instance_id)
                inst.status = "failed"
                inst.stage = f"状态查询失败：{exc}"[:120]
                db.commit()
                return

            _apply_state(inst, state.status, state.progress, state.stage, state.nodes)
            db.commit()
            if state.status in ("running", "failed"):
                log.info("实例 %s 部署结束：%s", instance_id, state.status)
                return

        inst.status = "failed"
        inst.stage = "部署超时"
        db.commit()
    finally:
        db.close()


def schedule_deploy(instance_id: str) -> None:
    task = asyncio.create_task(_run(instance_id))
    _bg_tasks.add(task)
    task.add_done_callback(_bg_tasks.discard)


def destroy_instance(db, inst: Instance) -> None:
    """销毁实例：真实驱动会删除虚机，mock 只改状态。"""
    handle = (inst.profile or {}).get("handle")
    if handle:
        try:
            compute_provider().destroy(handle)
        except Exception as exc:  # noqa: BLE001
            log.warning("销毁资源失败 instance=%s: %s", inst.id, exc)

    inst.status = "destroyed"
    inst.stage = "已销毁"
    inst.progress = 0
    nodes = inst.nodes or []
    for n in nodes:
        n["status"] = "stopped"
    inst.nodes = nodes
    db.commit()
    db.refresh(inst)


def resize_instance(inst: Instance, node_id: str, cpu: int, memory: int) -> bool:
    """执行调度建议：调整节点规格（真实驱动走 Nova resize）。"""
    handle = (inst.profile or {}).get("handle")
    if not handle:
        return False
    try:
        compute_provider().resize(handle, node_id, cpu, memory)
        return True
    except Exception as exc:  # noqa: BLE001
        log.warning("调整规格失败 instance=%s: %s", inst.id, exc)
        return False


def create_instance(
    db,
    template: Template,
    *,
    name: str | None = None,
    business: str | None = None,
    station: str = "深圳（总部）资源池",
    profile: dict | None = None,
) -> Instance:
    topology = template.topology or {}
    inst = Instance(
        id=f"ins_{uuid.uuid4().hex[:10]}",
        name=name or f"{template.name}-{time.strftime('%H%M%S')}",
        template_id=template.id,
        template_name=template.name,
        business=business or template.business,
        status="provisioning",
        stage="资源申请",
        progress=5,
        station=station,
        profile=profile or {},
        nodes=build_instance_nodes(topology),
    )
    db.add(inst)
    db.commit()
    db.refresh(inst)
    return inst


def latest_template(db, template_id: str | None = None) -> Template | None:
    stmt = select(Template).order_by(Template.updated_at.desc())
    if template_id:
        return db.get(Template, template_id)
    return db.execute(stmt).scalars().first()
