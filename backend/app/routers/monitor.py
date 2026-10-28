import logging

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import ComputeNode, Instance
from ..providers import driver_status, metrics_provider
from ..providers.mock import MockMetricsProvider

router = APIRouter(prefix="/api/monitor", tags=["monitor"])
log = logging.getLogger("craas.monitor")

_fallback = MockMetricsProvider()

SITE_META = {
    "深圳（总部）资源池": {"region": "广东省深圳市南山区后海总部", "latency": "—", "base": {"cpu": 44, "memory": 51, "storage": 36, "network": 26}},
    "北京（边缘）资源池": {"region": "北京市海淀区边缘计算节点", "latency": "18ms", "base": {"cpu": 52, "memory": 57, "storage": 42, "network": 33}},
    "武汉（教学）资源池": {"region": "湖北省武汉市洪山区教学实验中心", "latency": "21ms", "base": {"cpu": 39, "memory": 47, "storage": 31, "network": 22}},
}

DEFAULT_META = {"region": "未登记", "latency": "—", "base": {"cpu": 40, "memory": 45, "storage": 35, "network": 25}}


def node_metrics(node) -> dict:
    """取节点指标：真实驱动失败时退回模拟数据，页面不中断。"""
    meta = SITE_META.get(getattr(node, "site", ""), DEFAULT_META)
    provider = metrics_provider()
    try:
        if getattr(provider, "name", "mock") == "mock":
            return provider.node(node, meta["base"])
        return provider.node(node)
    except Exception as exc:  # noqa: BLE001
        log.warning("指标获取失败 node=%s: %s", getattr(node, "name", ""), exc)
        return _fallback.node(node, meta["base"])


def node_history(node, points: int = 24, step_min: int = 5) -> list[dict]:
    try:
        return metrics_provider().history(node, points, step_min)
    except Exception as exc:  # noqa: BLE001
        log.warning("历史指标获取失败: %s", exc)
        return _fallback.history(node, points, step_min)


@router.get("/overview")
def overview(db: Session = Depends(get_db)) -> dict:
    nodes = db.execute(select(ComputeNode).order_by(ComputeNode.name)).scalars().all()
    instances = db.execute(select(Instance).where(Instance.status == "running")).scalars().all()

    pools: dict[str, dict] = {}
    node_list = []
    for n in nodes:
        meta = SITE_META.get(n.site, DEFAULT_META)
        m = node_metrics(n)
        p = pools.setdefault(n.site, {
            "name": n.site,
            "region": meta["region"],
            "latency": meta["latency"],
            "node_count": 0,
            "cpu": 0.0,
            "memory": 0.0,
            "storage": 0.0,
            "network": 0.0,
            "bandwidth": 0.0,
            "cost_per_hour": 0.0,
            "status": "online",
        })
        p["node_count"] += 1
        p["cpu"] += m["cpu"]
        p["memory"] += m["memory"]
        p["storage"] += m["storage"]
        p["network"] += m["network"]
        p["bandwidth"] += m["bandwidth_in"]
        p["cost_per_hour"] += n.price_per_hour

        node_list.append({
            "id": n.id,
            "name": n.name,
            "site": n.site,
            "ip": n.ip,
            "cpu_cores": n.cpu_cores,
            "memory_mb": n.memory_mb,
            "gpu": n.gpu_model,
            "status": "online",
            "metrics": m,
        })

    for p in pools.values():
        c = max(p["node_count"], 1)
        for key in ("cpu", "memory", "storage", "network"):
            p[key] = round(p[key] / c, 1)
        p["bandwidth"] = round(p["bandwidth"], 1)
        p["cost_per_hour"] = round(p["cost_per_hour"], 2)

    cpu_avg = round(sum(n["metrics"]["cpu"] for n in node_list) / max(len(node_list), 1), 1)
    return {
        "pools": list(pools.values()),
        "nodes": node_list,
        "drivers": driver_status(),
        "summary": {
            "pool_count": len(pools),
            "node_count": len(nodes),
            "instance_count": len(instances),
            "cpu_avg": cpu_avg,
            "cost_per_hour": round(sum(n.price_per_hour for n in nodes), 2),
        },
    }


@router.get("/nodes/{node_id}/history")
def history_points(node_id: str, points: int = 24, step: int = 5, db: Session = Depends(get_db)) -> dict:
    node = db.get(ComputeNode, node_id)
    if node is None:
        return {"points": _fallback.history(node_id, points, step)}
    return {"points": node_history(node, points, step)}
