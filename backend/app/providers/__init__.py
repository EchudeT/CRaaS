"""对接驱动注册表。

默认全部走 mock（演示环境不需要任何外部系统）；改环境变量即可切换，
配置不完整时自动退回 mock 并打日志，不会让服务起不来。
"""

from __future__ import annotations

import logging
import os

from .. import config
from .alertmanager import AlertmanagerProvider
from .base import Alert, DeploySpec, DeployState, NodeSpec
from .cmdb import CmdbProvider
from .mock import (
    MockAlertProvider,
    MockComputeProvider,
    MockMetricsProvider,
    MockResourceProvider,
)
from .openstack import OpenStackProvider
from .prometheus import PrometheusProvider

log = logging.getLogger("craas.providers")

__all__ = [
    "Alert",
    "DeploySpec",
    "DeployState",
    "NodeSpec",
    "compute_provider",
    "metrics_provider",
    "resource_provider",
    "alert_provider",
    "driver_status",
]

_cache: dict[str, object] = {}


def compute_provider():
    if "compute" in _cache:
        return _cache["compute"]
    name = config.COMPUTE_DRIVER
    if name == "openstack":
        if config.OS_AUTH_URL and config.OS_USERNAME and config.OS_PASSWORD:
            _cache["compute"] = OpenStackProvider()
            return _cache["compute"]
        log.warning("COMPUTE_DRIVER=openstack 但缺少 OS_AUTH_URL/OS_USERNAME/OS_PASSWORD，退回 mock")
    _cache["compute"] = MockComputeProvider()
    return _cache["compute"]


def metrics_provider():
    if "metrics" in _cache:
        return _cache["metrics"]
    if config.METRICS_DRIVER == "prometheus" and config.PROM_URL:
        _cache["metrics"] = PrometheusProvider()
    else:
        if config.METRICS_DRIVER == "prometheus":
            log.warning("METRICS_DRIVER=prometheus 但缺少 PROM_URL，退回 mock")
        _cache["metrics"] = MockMetricsProvider()
    return _cache["metrics"]


def resource_provider():
    if "resource" in _cache:
        return _cache["resource"]
    if config.RESOURCE_DRIVER == "cmdb" and config.CMDB_URL:
        _cache["resource"] = CmdbProvider()
    else:
        if config.RESOURCE_DRIVER == "cmdb":
            log.warning("RESOURCE_DRIVER=cmdb 但缺少 CMDB_URL，退回 mock")
        _cache["resource"] = MockResourceProvider()
    return _cache["resource"]


def alert_provider():
    if "alert" in _cache:
        return _cache["alert"]
    if config.ALERT_DRIVER == "alertmanager" and config.ALERT_URL:
        _cache["alert"] = AlertmanagerProvider()
    else:
        _cache["alert"] = MockAlertProvider()
    return _cache["alert"]


def driver_status() -> dict:
    """真实生效的驱动（配置不全的会显示为 mock）。"""
    return {
        "compute": getattr(compute_provider(), "name", "mock"),
        "metrics": getattr(metrics_provider(), "name", "mock"),
        "resource": getattr(resource_provider(), "name", "mock"),
        "alert": getattr(alert_provider(), "name", "mock"),
        "resource_sync_interval": config.RESOURCE_SYNC_INTERVAL,
        "env": {
            "COMPUTE_DRIVER": config.COMPUTE_DRIVER,
            "METRICS_DRIVER": config.METRICS_DRIVER,
            "RESOURCE_DRIVER": config.RESOURCE_DRIVER,
            "ALERT_DRIVER": config.ALERT_DRIVER,
        },
        "pid": os.getpid(),
    }
