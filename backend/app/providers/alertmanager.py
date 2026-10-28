"""Alertmanager 驱动：主动拉取外部告警，转成调度事件。

启用方式：
    ALERT_DRIVER=alertmanager
    ALERT_URL=http://<alertmanager>:9093

也支持由 Alertmanager 直接 webhook 推送到
`POST /api/scheduler/alerts`（推荐，实时且无需轮询）。
"""

from __future__ import annotations

import logging

import httpx

from .. import config

log = logging.getLogger("craas.alert")

METRIC_KEYWORDS = {
    "cpu": ("cpu", "load"),
    "memory": ("mem", "内存"),
    "network": ("network", "net", "带宽", "丢包"),
    "storage": ("disk", "fs", "storage", "磁盘"),
}


class AlertmanagerProvider:
    name = "alertmanager"

    def pull(self) -> list[dict]:
        url = f"{config.ALERT_URL.rstrip('/')}/api/v2/alerts"
        with httpx.Client(timeout=config.ALERT_TIMEOUT) as c:
            resp = c.get(url, params={"active": "true", "silenced": "false"})
            resp.raise_for_status()
            rows = resp.json()
        return [self.map_alert(r) for r in rows if isinstance(r, dict)]

    @staticmethod
    def map_alert(row: dict) -> dict:
        labels = row.get("labels", {}) or {}
        ann = row.get("annotations", {}) or {}
        name = labels.get("alertname", "外部告警")
        summary = ann.get("summary") or ann.get("description") or name

        metric = "cpu"
        low = f"{name} {summary}".lower()
        for key, words in METRIC_KEYWORDS.items():
            if any(w in low for w in words):
                metric = key
                break

        severity = labels.get("severity", "warning")
        return {
            "title": summary[:120],
            "instance_name": labels.get("instance_name") or labels.get("instance", "外部实例"),
            "node_name": labels.get("node") or labels.get("instance", "—"),
            "metric": metric,
            "level": "critical" if severity in ("critical", "fatal") else "warning",
            "value": float(ann.get("value", 0) or 0),
            "threshold": float(ann.get("threshold", 85) or 85),
            "suggestion": ann.get("suggestion", "建议按告警内容调整该节点资源规格或迁移负载"),
            "action_label": "资源调整",
        }
