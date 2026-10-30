import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import ComputeNode, Instance
from ..providers import driver_status, metrics_provider
from ..providers.mock import MockMetricsProvider
from ..services.scene_data import check_scene, instance_context, resource_context, resource_contexts

router = APIRouter(prefix="/api/monitor", tags=["monitor"])
log = logging.getLogger("craas.monitor")

_fallback = MockMetricsProvider()

SITE_META = {
    "深圳（总部）资源池": {"region": "广东省深圳市南山区后海总部", "latency": "—", "base": {"cpu": 44, "memory": 51, "storage": 36, "network": 26}},
    "北京（边缘）资源池": {"region": "北京市海淀区边缘计算节点", "latency": "18ms", "base": {"cpu": 52, "memory": 57, "storage": 42, "network": 33}},
    "武汉（教学）资源池": {"region": "湖北省武汉市洪山区教学实验中心", "latency": "21ms", "base": {"cpu": 39, "memory": 47, "storage": 31, "network": 22}},
}

DEFAULT_META = {"region": "未登记", "latency": "—", "base": {"cpu": 40, "memory": 45, "storage": 35, "network": 25}}


def node_metrics(node, demo=False) -> dict:
    """取节点指标：真实驱动失败时退回模拟数据，页面不中断。"""
    meta = SITE_META.get(getattr(node, "site", ""), DEFAULT_META)
    provider = _fallback if demo else metrics_provider()
    try:
        if getattr(provider, "name", "mock") == "mock":
            return {**provider.node(node, meta["base"]), "source": "demo" if demo else "mock"}
        return {**provider.node(node), "source": "real"}
    except Exception as exc:  # noqa: BLE001
        log.warning("指标获取失败 node=%s: %s", getattr(node, "name", ""), exc)
        return {**_fallback.node(node, meta["base"]), "source": "fallback"}


def node_history(node, points: int = 24, step_min: int = 5, demo=False) -> dict:
    try:
        provider = _fallback if demo else metrics_provider()
        source = "demo" if demo else "mock" if getattr(provider, "name", "mock") == "mock" else "real"
        return {"points": provider.history(node, points, step_min), "source": source}
    except Exception as exc:  # noqa: BLE001
        log.warning("历史指标获取失败: %s", exc)
        return {"points": _fallback.history(node, points, step_min), "source": "fallback"}


@router.get("/overview")
def overview(scene: str = "", db: Session = Depends(get_db)) -> dict:
    check_scene(scene)
    nodes = db.execute(select(ComputeNode).order_by(ComputeNode.name)).scalars().all()
    contexts = resource_contexts(db, "compute")
    nodes = [n for n in nodes if not scene or scene in resource_context(contexts.get(n.id))["scene_ids"]]
    instances = db.execute(select(Instance).where(Instance.status.in_(["running", "demo"]))).scalars().all()
    instances = [i for i in instances if not scene or instance_context(i)["scene"] == scene]

    pools: dict[str, dict] = {}
    node_list = []
    for n in nodes:
        meta = SITE_META.get(n.site, DEFAULT_META)
        context = resource_context(contexts.get(n.id))
        m = node_metrics(n, demo=context["is_demo"])
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
            **context,
            "id": n.id,
            "name": n.name,
            "site": n.site,
            "ip": n.ip,
            "cpu_cores": n.cpu_cores,
            "memory_mb": n.memory_mb,
            "gpu": n.gpu_model,
            "status": "demo" if context["is_demo"] else n.status,
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
        "instances": [{"id": i.id, "name": i.name, "template_id": i.template_id, **instance_context(i)} for i in instances],
        "summary": {
            "pool_count": len(pools),
            "node_count": len(nodes),
            "instance_count": len(instances),
            "demo_instance_count": sum(instance_context(i)["is_demo"] for i in instances),
            "cpu_avg": cpu_avg,
            "cost_per_hour": round(sum(n.price_per_hour for n in nodes), 2),
        },
    }


@router.get("/nodes/{node_id}/history")
def history_points(node_id: str, points: int = Query(24, ge=1, le=288), step: int = Query(5, ge=1, le=60), db: Session = Depends(get_db)) -> dict:
    node = db.get(ComputeNode, node_id)
    if node is None:
        raise HTTPException(404, "计算节点不存在")
    context = resource_context(resource_contexts(db, "compute").get(node_id))
    return {**node_history(node, points, step, demo=context["is_demo"]), **context}
