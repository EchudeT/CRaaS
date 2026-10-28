"""Prometheus 驱动：从 node_exporter 读取真实节点指标。

启用方式：
    METRICS_DRIVER=prometheus
    PROM_URL=http://<prometheus>:9090
    PROM_NIC=eth0
    PROM_NIC_BPS=1000000000        # 网卡带宽，用于把字节速率换算成占用百分比

节点与指标实例的对应关系：默认用节点 IP 匹配 `instance=~"<ip>:.*"`。
如果你们的 node_exporter 用的是别的标签（比如 hostname），改 _selector() 即可。
"""

from __future__ import annotations

import logging
import time

import httpx

from .. import config

log = logging.getLogger("craas.prometheus")


class PrometheusProvider:
    name = "prometheus"

    def __init__(self) -> None:
        self._client = httpx.Client(timeout=config.PROM_TIMEOUT, base_url=config.PROM_URL.rstrip("/"))

    # ---------------------------------------------------------------- 基础
    def _selector(self, node) -> str:
        ip = getattr(node, "ip", "") or ""
        if ip:
            return f'instance=~"{ip}:.*"'
        # 没有 IP 时退化为按节点名匹配
        return f'instance=~"{getattr(node, "name", "")}.*"'

    def _query(self, expr: str) -> float:
        resp = self._client.get("/api/v1/query", params={"query": expr})
        resp.raise_for_status()
        data = resp.json().get("data", {}).get("result", [])
        if not data:
            raise ValueError(f"Prometheus 无数据：{expr[:80]}")
        return float(data[0]["value"][1])

    def _query_range(self, expr: str, start: float, end: float, step: int) -> list[tuple[float, float]]:
        resp = self._client.get(
            "/api/v1/query_range",
            params={"query": expr, "start": start, "end": end, "step": step},
        )
        resp.raise_for_status()
        data = resp.json().get("data", {}).get("result", [])
        if not data:
            return []
        return [(float(ts), float(v)) for ts, v in data[0]["values"]]

    # ---------------------------------------------------------------- 指标
    def node(self, node) -> dict:
        sel = self._selector(node)
        cpu = self._query(
            f'100 - (avg by(instance) (rate(node_cpu_seconds_total{{mode="idle",{sel}}}[5m])) * 100)'
        )
        mem = self._query(
            f"(1 - (node_memory_MemAvailable_bytes{{{sel}}} / node_memory_MemTotal_bytes{{{sel}}})) * 100"
        )
        try:
            disk = self._query(
                "max by(instance) ((1 - node_filesystem_avail_bytes{"
                f'{sel},fstype!~"tmpfs|overlay|squashfs|iso9660"}} / node_filesystem_size_bytes{{'
                f'{sel},fstype!~"tmpfs|overlay|squashfs|iso9660"}}) * 100)'
            )
        except ValueError:
            disk = 0.0

        rx = self._query(
            f'rate(node_network_receive_bytes_total{{{sel},device="{config.PROM_NIC}"}}[5m])'
        )
        tx = self._query(
            f'rate(node_network_transmit_bytes_total{{{sel},device="{config.PROM_NIC}"}}[5m])'
        )
        peak_bps = max(rx, tx) * 8
        net_pct = min(100.0, peak_bps / max(config.PROM_NIC_BPS, 1) * 100)

        return {
            "cpu": round(cpu, 1),
            "memory": round(mem, 1),
            "storage": round(disk, 1),
            "network": round(net_pct, 1),
            "bandwidth_in": round(rx * 8 / 1_000_000, 1),
            "bandwidth_out": round(tx * 8 / 1_000_000, 1),
            "latency": 0.0,
        }

    def history(self, node, points: int = 24, step_min: int = 5) -> list[dict]:
        sel = self._selector(node)
        end = time.time()
        start = end - points * step_min * 60
        step = step_min * 60
        cpu = self._query_range(
            f'100 - (avg by(instance) (rate(node_cpu_seconds_total{{mode="idle",{sel}}}[5m])) * 100)',
            start,
            end,
            step,
        )
        mem = self._query_range(
            f"(1 - (node_memory_MemAvailable_bytes{{{sel}}} / node_memory_MemTotal_bytes{{{sel}}})) * 100",
            start,
            end,
            step,
        )
        net = self._query_range(
            f'rate(node_network_receive_bytes_total{{{sel},device="{config.PROM_NIC}"}}[5m]) * 8'
            f" / {config.PROM_NIC_BPS} * 100",
            start,
            end,
            step,
        )
        # 三条曲线按时间戳对齐，取 CPU 的点为准
        mem_map = {int(ts): v for ts, v in mem}
        net_map = {int(ts): v for ts, v in net}
        out = []
        for ts, v in cpu:
            out.append({
                "t": time.strftime("%H:%M", time.localtime(ts)),
                "cpu": round(v, 1),
                "memory": round(mem_map.get(int(ts), 0.0), 1),
                "network": round(net_map.get(int(ts), 0.0), 1),
            })
        return out[-points:]
