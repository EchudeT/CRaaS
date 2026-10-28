import logging
import uuid
from datetime import datetime
from types import SimpleNamespace

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import config
from ..db import get_db
from ..models import DispatchEvent, Instance
from ..providers import alert_provider, driver_status, metrics_provider
from ..services import executor

router = APIRouter(prefix="/api/scheduler", tags=["scheduler"])
log = logging.getLogger("craas.scheduler")

METRIC_LABEL = {"cpu": "CPU", "memory": "内存", "storage": "存储", "network": "网络"}
SUGGEST = {
    "cpu": ("CPU 升配", "节点 CPU 持续高位，建议提升 CPU 核数或迁移部分负载到空闲节点"),
    "memory": ("内存扩容", "节点内存占用过高，建议扩内存规格，避免实例被 OOM 终止"),
    "storage": ("磁盘扩容", "磁盘使用率接近阈值，建议扩容数据盘或清理历史镜像"),
    "network": ("带宽调整", "网络出口占用过高，建议提升带宽或限制异常流量"),
}


def ser(e: DispatchEvent) -> dict:
    return {
        "id": e.id,
        "level": e.level,
        "title": e.title,
        "instance_id": e.instance_id,
        "instance_name": e.instance_name,
        "node_name": e.node_name,
        "metric": e.metric,
        "trigger_desc": e.trigger_desc,
        "suggestion": e.suggestion,
        "action_label": e.action_label,
        "before": e.before,
        "after": e.after,
        "status": e.status,
        "created_at": e.created_at.isoformat(timespec="seconds"),
    }


@router.get("/events")
def list_events(status: str = "", db: Session = Depends(get_db)) -> dict:
    items = db.execute(select(DispatchEvent).order_by(DispatchEvent.created_at.desc())).scalars().all()
    if status:
        items = [e for e in items if e.status == status]
    return {
        "items": [ser(e) for e in items],
        "summary": {
            "pending": sum(1 for e in items if e.status == "pending"),
            "executed": sum(1 for e in items if e.status == "executed"),
            "ignored": sum(1 for e in items if e.status == "ignored"),
        },
    }


# ------------------------------------------------------------------ 事件生成
def _read_metrics(node: dict, station: str) -> dict:
    """读取节点当前四项指标，取不到就给一组兜底值。"""
    shim = SimpleNamespace(id=node.get("id", ""), ip=node.get("ip", ""), name=node.get("name", ""), site=station)
    try:
        m = metrics_provider().node(shim)
        return {k: float(m.get(k, 0)) for k in ("cpu", "memory", "storage", "network")}
    except Exception as exc:  # noqa: BLE001
        log.warning("调度取指标失败: %s", exc)
        return {"cpu": 56.0, "memory": 58.0, "storage": 22.0, "network": 44.0}


def _find_instance(db: Session, instance_id: str, instance_name: str) -> Instance | None:
    if instance_id:
        inst = db.get(Instance, instance_id)
        if inst:
            return inst
    if instance_name:
        items = db.execute(select(Instance).where(Instance.name == instance_name)).scalars().all()
        if items:
            return items[0]
    return None


def _pending_exists(db: Session, inst_id: str, node_name: str, metric: str) -> bool:
    rows = db.execute(select(DispatchEvent).where(DispatchEvent.status == "pending")).scalars().all()
    return any(e.instance_id == inst_id and e.node_name == node_name and e.metric == metric for e in rows)


def _create_event(
    db: Session,
    *,
    instance: Instance | None,
    instance_name: str,
    node_name: str,
    node: dict,
    metric: str,
    level: str,
    value: float,
    threshold: float,
    title: str = "",
    suggestion: str = "",
) -> DispatchEvent:
    station = instance.station if instance else ""
    current = _read_metrics(node, station)
    current[metric] = round(value, 1)

    after = dict(current)
    if value >= threshold:  # 高位 → 扩容后回落
        after[metric] = round(max(current[metric] * 0.72, 12), 1)
        if metric in ("cpu", "memory"):
            for other in ("cpu", "memory"):
                if other != metric:
                    after[other] = round(max(current[other] * 0.92, 8), 1)
        action_label = SUGGEST.get(metric, ("资源调整", ""))[0]
        default_suggest = SUGGEST.get(metric, ("资源调整", "建议调整该节点资源规格"))[1]
    else:  # 低负载 → 降配
        after[metric] = round(min(current[metric] * 1.18, 96), 1)
        action_label = "资源降配"
        default_suggest = "节点长期低负载，建议降低规格以释放资源池容量"

    e = DispatchEvent(
        id=f"evt_{uuid.uuid4().hex[:8]}",
        level=level,
        title=title or f"{node_name} {METRIC_LABEL.get(metric, metric)} {action_label}建议",
        instance_id=instance.id if instance else "",
        instance_name=instance.name if instance else instance_name,
        node_name=node_name,
        metric=metric,
        trigger_desc=f"{METRIC_LABEL.get(metric, metric)} 占用 {value:.0f}%，阈值 {threshold:.0f}%（节点 {node.get('ip', '—')}）",
        suggestion=suggestion or default_suggest,
        action_label=action_label,
        before=current,
        after=after,
        status="pending",
        created_at=datetime.now(),
    )
    db.add(e)
    return e


# ------------------------------------------------------------------ 外部告警
class AlertIn(BaseModel):
    """Alertmanager / 监控平台的告警结构，字段都有默认值，缺省也能创建事件。"""

    title: str = ""
    instance_id: str = ""
    instance_name: str = ""
    node_name: str = ""
    node_ip: str = ""
    metric: str = "cpu"
    level: str = "warning"
    value: float = 90
    threshold: float = 85
    suggestion: str = ""
    action_label: str = ""


@router.post("/alerts")
def ingest_alerts(payload: list[AlertIn] | AlertIn, db: Session = Depends(get_db)) -> dict:
    """告警接入 webhook：Alertmanager 或任意监控平台把告警推到这里。"""
    rows = payload if isinstance(payload, list) else [payload]
    created = 0
    for row in rows:
        inst = _find_instance(db, row.instance_id, row.instance_name)
        node = {}
        if inst:
            node = next((n for n in inst.nodes or [] if n.get("name") == row.node_name), {}) or {}
        node = {**node, "ip": row.node_ip or node.get("ip", "")}
        node_name = row.node_name or node.get("name", "未知节点")
        inst_id = inst.id if inst else row.instance_id
        if inst_id and _pending_exists(db, inst_id, node_name, row.metric):
            continue
        _create_event(
            db,
            instance=inst,
            instance_name=row.instance_name,
            node_name=node_name,
            node=node,
            metric=row.metric if row.metric in METRIC_LABEL else "cpu",
            level=row.level if row.level in ("info", "warning", "critical") else "warning",
            value=row.value,
            threshold=row.threshold,
            title=row.title,
            suggestion=row.suggestion,
        )
        created += 1
    db.commit()
    return {"created": created, "received": len(rows), "provider": getattr(alert_provider(), "name", "mock")}


@router.post("/evaluate")
def evaluate(db: Session = Depends(get_db)) -> dict:
    """阈值巡检：扫描运行中实例的节点指标，超阈值即生成调度事件。"""
    instances = db.execute(select(Instance).where(Instance.status == "running")).scalars().all()
    created = 0
    for inst in instances:
        for n in inst.nodes or []:
            if n.get("type") == "cloud" or n.get("status") != "running":
                continue
            m = _read_metrics(n, inst.station)
            for metric, threshold in (
                ("cpu", config.THRESHOLD_CPU),
                ("memory", config.THRESHOLD_MEMORY),
                ("network", config.THRESHOLD_NETWORK),
            ):
                if m[metric] < threshold:
                    continue
                if _pending_exists(db, inst.id, n.get("name", ""), metric):
                    continue
                _create_event(
                    db,
                    instance=inst,
                    instance_name=inst.name,
                    node_name=n.get("name", ""),
                    node=n,
                    metric=metric,
                    level="critical" if m[metric] >= threshold + 8 else "warning",
                    value=m[metric],
                    threshold=threshold,
                )
                created += 1
    db.commit()
    return {"created": created, "scanned_instances": len(instances)}


@router.get("/drivers")
def drivers() -> dict:
    return driver_status()


# ------------------------------------------------------------------ 事件处理
@router.post("/events/{event_id}/execute")
def execute(event_id: str, db: Session = Depends(get_db)) -> dict:
    e = db.get(DispatchEvent, event_id)
    if not e:
        raise HTTPException(404, "调度事件不存在")

    applied = False
    if e.instance_id:
        inst = db.get(Instance, e.instance_id)
        node = next((n for n in (inst.nodes or []) if n.get("name") == e.node_name), None) if inst else None
        if inst and node:
            target = (e.after or {}).get("_target") or {}
            cpu = int(target.get("cpu") or node.get("cpu", 2))
            memory = int(target.get("memory") or node.get("memory", 4096))
            applied = executor.resize_instance(inst, node.get("id", ""), cpu, memory)
            if applied:
                node["cpu"], node["memory"] = cpu, memory
                inst.nodes = inst.nodes
                db.commit()

    e.status = "executed"
    after = dict(e.after or {})
    after["applied_at"] = datetime.now().isoformat(timespec="seconds")
    after["applied_to_platform"] = applied
    e.after = after
    db.commit()
    db.refresh(e)
    return ser(e)


@router.post("/events/{event_id}/ignore")
def ignore(event_id: str, db: Session = Depends(get_db)) -> dict:
    e = db.get(DispatchEvent, event_id)
    if not e:
        raise HTTPException(404, "调度事件不存在")
    e.status = "ignored"
    db.commit()
    db.refresh(e)
    return ser(e)
