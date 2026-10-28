"""演示用驱动：不依赖任何外部系统，保证 Demo 开箱即跑。"""

from __future__ import annotations

import math
import random
import time

from .base import DeploySpec, DeployState

STAGES = [
    ("资源申请", 8, 1.4),
    ("镜像分发", 32, 2.8),
    ("网络编排", 62, 4.2),
    ("实例启动", 88, 5.6),
    ("就绪", 100, 7.0),
]


class MockComputeProvider:
    name = "mock"

    def deploy(self, spec: DeploySpec) -> tuple[str, DeployState]:
        handle = f"{spec.instance_id}:{time.time():.3f}"
        return handle, DeployState(status="provisioning", progress=5, stage="资源申请")

    def poll(self, handle: str, spec: DeploySpec) -> DeployState:
        try:
            started = float(handle.split(":")[-1])
        except (ValueError, IndexError):
            started = time.time()
        elapsed = time.time() - started

        stage, progress = STAGES[-1][0], STAGES[-1][1]
        for name, pct, at in STAGES:
            if elapsed < at:
                stage, progress = name, pct
                break

        finished = elapsed >= STAGES[-1][2]
        return DeployState(
            status="running" if finished else "provisioning",
            progress=progress,
            stage=stage,
        )

    def destroy(self, handle: str) -> None:
        return None

    def resize(self, handle: str, node_id: str, cpu: int, memory: int) -> None:
        return None


def _wave(seed: int, t: float, base: float, amp: float) -> float:
    v = base + amp * math.sin(t / 21.0 + seed * 1.7) + amp * 0.55 * math.sin(t / 5.3 + seed * 2.9)
    return max(3.0, min(97.0, v))


class MockMetricsProvider:
    name = "mock"

    def node(self, node, base: dict | None = None) -> dict:
        key = getattr(node, "id", str(node))
        seed = abs(hash(key)) % 997
        t = time.time() / 4.0
        base = base or {"cpu": 46, "memory": 52, "storage": 38, "network": 24}
        return {
            "cpu": round(_wave(seed, t, base["cpu"], 16), 1),
            "memory": round(_wave(seed + 11, t, base["memory"], 13), 1),
            "storage": round(_wave(seed + 23, t / 3, base["storage"], 6), 1),
            "network": round(_wave(seed + 37, t, base["network"], 12), 1),
            "bandwidth_in": round(_wave(seed + 51, t, 220, 120), 1),
            "bandwidth_out": round(_wave(seed + 67, t, 160, 90), 1),
            "latency": round(abs(_wave(seed + 81, t, 12, 9)) / 10 + 1.2, 2),
        }

    def history(self, node, points: int = 24, step_min: int = 5) -> list[dict]:
        key = getattr(node, "id", str(node))
        seed = abs(hash(key)) % 997
        now = time.time()
        out = []
        for i in range(points):
            t = (now - (points - i) * step_min * 60) / 240.0
            out.append({
                "t": time.strftime("%H:%M", time.localtime(now - (points - i) * step_min * 60)),
                "cpu": round(_wave(seed, t, 46, 18), 1),
                "memory": round(_wave(seed + 11, t, 52, 14), 1),
                "network": round(_wave(seed + 37, t, 26, 14), 1),
            })
        return out


class MockResourceProvider:
    name = "mock"

    def images(self) -> list[dict]:
        return []

    def compute(self) -> list[dict]:
        return []

    def networks(self) -> list[dict]:
        return []

    def storages(self) -> list[dict]:
        return []


class MockAlertProvider:
    name = "mock"

    def pull(self) -> list[dict]:
        return []


def random_port(seed: str, base: int = 20000) -> int:
    return base + random.Random(seed).randint(1, 900)
