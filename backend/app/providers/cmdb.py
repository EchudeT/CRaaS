"""CMDB / 镜像仓库驱动：把企业已有的资源台账同步成"资源封装"里的数据。

启用方式：
    RESOURCE_DRIVER=cmdb
    CMDB_URL=https://<cmdb>/api
    CMDB_TOKEN=<访问令牌>
    CMDB_IMAGE_PATH=/v1/images
    CMDB_COMPUTE_PATH=/v1/nodes
    CMDB_NETWORK_PATH=/v1/networks
    CMDB_STORAGE_PATH=/v1/storages

约定的返回结构（数组或 {"items": [...]}）：
    镜像：{"name","category","sub_category","os_type","size_gb","version","source","arch"}
    算力：{"name","node_type","cluster","ip","port","cpu_cores","memory_mb","site","price_per_hour"}
    网络：{"name","network_type","cidr","vlan","bandwidth","site","used_ips","total_ips"}
    存储：{"name","storage_type","site","capacity_tb","used_tb","iops","protocol"}

字段名和你们 CMDB 不一致时，只改下面的 map_* 函数即可，其它代码不用动。
"""

from __future__ import annotations

import logging

import httpx

from .. import config

log = logging.getLogger("craas.cmdb")


def _first(row: dict, *keys, default=None):
    for k in keys:
        if k in row and row[k] not in (None, ""):
            return row[k]
    return default


class CmdbProvider:
    name = "cmdb"

    def __init__(self) -> None:
        self._headers = {"Authorization": f"Bearer {config.CMDB_TOKEN}"} if config.CMDB_TOKEN else {}

    def _get(self, path: str) -> list[dict]:
        if not path:
            return []
        url = f"{config.CMDB_URL.rstrip('/')}/{path.lstrip('/')}"
        with httpx.Client(timeout=config.CMDB_TIMEOUT, headers=self._headers) as c:
            resp = c.get(url)
            resp.raise_for_status()
            body = resp.json()
        if isinstance(body, dict):
            return body.get("items") or body.get("data") or body.get("results") or []
        return body or []

    # ------------------------------------------------------------ 字段映射
    @staticmethod
    def map_image(row: dict) -> dict:
        size = _first(row, "size_gb", "size", default=0)
        if isinstance(size, (int, float)) and size > 10000:  # 可能是字节
            size = round(size / 1024**3, 1)
        return {
            "name": _first(row, "name", "repo_name", "image", default="未命名镜像"),
            "category": _first(row, "category", "type", default="应用镜像"),
            "sub_category": _first(row, "sub_category", "group", default="通用镜像"),
            "os_type": _first(row, "os_type", "os", default="Linux"),
            "size_gb": float(size or 0),
            "version": str(_first(row, "version", "tag", default="v1.0")),
            "source": _first(row, "source", "registry", default="CMDB"),
            "arch": _first(row, "arch", default="x86_64"),
            "status": _first(row, "status", default="可用"),
        }

    @staticmethod
    def map_compute(row: dict) -> dict:
        mem = _first(row, "memory_mb", "memory", default=16384)
        return {
            "name": _first(row, "name", "hostname", default="未命名节点"),
            "node_type": _first(row, "node_type", "type", default="物理机"),
            "cluster": _first(row, "cluster", "group", default=""),
            "ip": _first(row, "ip", "ip_address", "mgmt_ip", default=""),
            "port": int(_first(row, "port", default=18000)),
            "os_type": _first(row, "os_type", "os", default="Linux"),
            "pool": _first(row, "pool", default="计算资源"),
            "domain": _first(row, "domain", default="private"),
            "site": _first(row, "site", "zone", default="深圳（总部）资源池"),
            "cpu_cores": int(_first(row, "cpu_cores", "vcpus", "cpu", default=16)),
            "memory_mb": int(mem),
            "cpu_model": _first(row, "cpu_model", default=""),
            "gpu_model": _first(row, "gpu_model", default=""),
            "gpu_count": int(_first(row, "gpu_count", default=0)),
            "gpu_mem": int(_first(row, "gpu_mem", default=0)),
            "raid": _first(row, "raid", default="RAID10"),
            "price_per_hour": float(_first(row, "price_per_hour", "price", default=1.2)),
            "api": _first(row, "api", default=""),
            "status": _first(row, "status", default="在线"),
        }

    @staticmethod
    def map_network(row: dict) -> dict:
        return {
            "name": _first(row, "name", default="未命名网络"),
            "network_type": _first(row, "network_type", "type", default="虚拟网络"),
            "cidr": _first(row, "cidr", "subnet", default=""),
            "vlan": int(_first(row, "vlan", default=0)),
            "bandwidth": str(_first(row, "bandwidth", default="1Gbps")),
            "site": _first(row, "site", default="深圳（总部）资源池"),
            "used_ips": int(_first(row, "used_ips", default=0)),
            "total_ips": int(_first(row, "total_ips", default=254)),
            "status": _first(row, "status", default="可用"),
        }

    @staticmethod
    def map_storage(row: dict) -> dict:
        return {
            "name": _first(row, "name", default="未命名存储"),
            "storage_type": _first(row, "storage_type", "type", default="分布式块存储"),
            "site": _first(row, "site", default="深圳（总部）资源池"),
            "capacity_tb": float(_first(row, "capacity_tb", "capacity", default=100)),
            "used_tb": float(_first(row, "used_tb", "used", default=0)),
            "iops": int(_first(row, "iops", default=80000)),
            "protocol": _first(row, "protocol", default="iSCSI"),
            "price_per_gb": float(_first(row, "price_per_gb", default=0.0004)),
            "status": _first(row, "status", default="可用"),
        }

    # ------------------------------------------------------------ 拉取
    def images(self) -> list[dict]:
        return [self.map_image(r) for r in self._get(config.CMDB_IMAGE_PATH)]

    def compute(self) -> list[dict]:
        return [self.map_compute(r) for r in self._get(config.CMDB_COMPUTE_PATH)]

    def networks(self) -> list[dict]:
        return [self.map_network(r) for r in self._get(config.CMDB_NETWORK_PATH)]

    def storages(self) -> list[dict]:
        return [self.map_storage(r) for r in self._get(config.CMDB_STORAGE_PATH)]
