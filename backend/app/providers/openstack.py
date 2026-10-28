"""OpenStack Nova 驱动：把场景模板实例化成真实虚机。

启用方式（环境变量）：
    COMPUTE_DRIVER=openstack
    OS_AUTH_URL=https://<keystone>/v3
    OS_USERNAME=...  OS_PASSWORD=...  OS_PROJECT_NAME=...
    OS_NETWORK_ID=<目标网络 uuid>
    OS_IMAGE_MAP={"ubuntu-2204-server": "<image uuid>", ...}

流程：deploy 时为每个节点创建一个 server，poll 轮询状态直到 ACTIVE，
把真实 IP/端口回填到实例节点；destroy 删除全部 server；resize 走 Nova 的 resize 动作。
"""

from __future__ import annotations

import json
import logging
import time

import httpx

from .. import config
from .base import DeploySpec, DeployState

log = logging.getLogger("craas.openstack")


class OpenStackProvider:
    name = "openstack"

    def __init__(self) -> None:
        self._token: str | None = None
        self._token_expire = 0.0
        self._compute_endpoint: str | None = None

    # ---------------------------------------------------------------- 鉴权
    def _authenticate(self) -> None:
        if self._token and time.time() < self._token_expire:
            return
        payload = {
            "auth": {
                "identity": {
                    "methods": ["password"],
                    "password": {
                        "user": {
                            "name": config.OS_USERNAME,
                            "domain": {"name": config.OS_USER_DOMAIN},
                            "password": config.OS_PASSWORD,
                        }
                    },
                },
                "scope": {
                    "project": {
                        "name": config.OS_PROJECT_NAME,
                        "domain": {"name": config.OS_PROJECT_DOMAIN},
                    }
                },
            }
        }
        with httpx.Client(timeout=config.OS_TIMEOUT, verify=False) as c:
            resp = c.post(f"{config.OS_AUTH_URL.rstrip('/')}/auth/tokens", json=payload)
            resp.raise_for_status()
            self._token = resp.headers.get("X-Subject-Token", "")
            body = resp.json()
        self._token_expire = time.time() + 1800
        for entry in body.get("token", {}).get("catalog", []):
            if entry.get("type") == "compute":
                for ep in entry.get("endpoints", []):
                    if ep.get("interface") == "public" and ep.get("region", config.OS_REGION) == config.OS_REGION:
                        self._compute_endpoint = ep["url"].rstrip("/")
                        break
        if not self._compute_endpoint:
            raise RuntimeError("未在 Keystone catalog 中找到 compute 服务")

    def _headers(self) -> dict:
        self._authenticate()
        return {"X-Auth-Token": self._token or "", "Content-Type": "application/json"}

    def _client(self) -> httpx.Client:
        return httpx.Client(timeout=config.OS_TIMEOUT, verify=False, headers=self._headers())

    # ---------------------------------------------------------------- 映射
    def _image_ref(self, image_name: str, client: httpx.Client) -> str:
        mapping: dict = {}
        try:
            mapping = json.loads(config.OS_IMAGE_MAP or "{}")
        except json.JSONDecodeError:
            log.warning("OS_IMAGE_MAP 不是合法 JSON，忽略")
        if image_name in mapping:
            return mapping[image_name]
        # 退化为按名称在 Glance 里找
        resp = client.get(f"{self._compute_endpoint}/images/detail")
        resp.raise_for_status()
        for img in resp.json().get("images", []):
            if img.get("name") == image_name:
                return img["id"]
        raise RuntimeError(f"OpenStack 中找不到镜像：{image_name}，请补充 OS_IMAGE_MAP")

    def _flavor_ref(self, cpu: int, memory: int, client: httpx.Client) -> str:
        resp = client.get(f"{self._compute_endpoint}/flavors/detail")
        resp.raise_for_status()
        best = None
        for f in resp.json().get("flavors", []):
            if f.get("vcpus") == cpu and f.get("ram") == memory:
                return f["id"]
            if f.get("vcpus", 0) >= cpu and f.get("ram", 0) >= memory:
                if best is None or f["vcpus"] * f["ram"] < best["vcpus"] * best["ram"]:
                    best = f
        if best:
            return best["id"]
        raise RuntimeError(f"OpenStack 中找不到满足 {cpu}C/{memory}MB 的规格")

    # ---------------------------------------------------------------- 部署
    def deploy(self, spec: DeploySpec) -> tuple[str, DeployState]:
        with self._client() as c:
            servers: list[str] = []
            for idx, n in enumerate(spec.nodes):
                if n.type == "cloud":  # 互联网出口不是真实虚机
                    continue
                body = {
                    "server": {
                        "name": f"{spec.name}-{n.name}"[:60],
                        "imageRef": self._image_ref(n.image, c),
                        "flavorRef": self._flavor_ref(n.cpu, n.memory, c),
                        "metadata": {
                            "instance_id": spec.instance_id,
                            "node_id": n.id,
                            "station": spec.station,
                        },
                    }
                }
                if config.OS_NETWORK_ID:
                    body["server"]["networks"] = [{"uuid": config.OS_NETWORK_ID}]
                if config.OS_AVAILABILITY_ZONE:
                    body["server"]["availability_zone"] = config.OS_AVAILABILITY_ZONE
                resp = c.post(f"{self._compute_endpoint}/servers", json=body)
                if resp.status_code >= 400:
                    raise RuntimeError(f"创建虚机失败：{resp.status_code} {resp.text[:200]}")
                sid = resp.json()["server"]["id"]
                servers.append(sid)
                log.info("已提交虚机创建 node=%s server=%s", n.name, sid)

        handle = json.dumps({"servers": servers, "created_at": int(time.time())})
        return handle, DeployState(status="provisioning", progress=20, stage="实例启动")

    def poll(self, handle: str, spec: DeploySpec) -> DeployState:
        data = json.loads(handle)
        servers: list[str] = data.get("servers", [])
        created = data.get("created_at", time.time())

        if time.time() - created > config.COMPUTE_TIMEOUT:
            return DeployState(status="failed", progress=100, stage="部署超时", message="超过 COMPUTE_TIMEOUT")

        done, failed, nodes = 0, False, []
        with self._client() as c:
            for sid in servers:
                resp = c.get(f"{self._compute_endpoint}/servers/{sid}")
                if resp.status_code >= 400:
                    failed = True
                    continue
                srv = resp.json()["server"]
                status = srv.get("status", "")
                if status == "ACTIVE":
                    done += 1
                    ip = self._first_ip(srv)
                    node_id = srv.get("metadata", {}).get("node_id", "")
                    nodes.append({
                        "id": node_id,
                        "ip": ip or "—",
                        "ssh_port": 22,
                        "status": "running",
                        "external_id": sid,
                        "username": "root",
                        # 真实环境请由 cloud-init / 密钥服务下发，不要明文保存
                        "password": "（由镜像初始化配置）",
                    })
                elif status in ("ERROR", "DELETED"):
                    failed = True

        if failed:
            return DeployState(status="failed", progress=100, stage="实例创建失败", nodes=nodes)
        if servers and done == len(servers):
            return DeployState(status="running", progress=100, stage="就绪", nodes=nodes)
        progress = 20 + int(70 * done / max(len(servers), 1))
        return DeployState(status="provisioning", progress=progress, stage="实例启动")

    @staticmethod
    def _first_ip(srv: dict) -> str:
        for _net, addrs in (srv.get("addresses") or {}).items():
            for a in addrs:
                if a.get("OS-EXT-IPS:type") == "fixed" and a.get("addr"):
                    return a["addr"]
        return ""

    def destroy(self, handle: str) -> None:
        try:
            servers = json.loads(handle).get("servers", [])
        except (json.JSONDecodeError, AttributeError):
            return
        with self._client() as c:
            for sid in servers:
                resp = c.delete(f"{self._compute_endpoint}/servers/{sid}")
                log.info("删除虚机 %s -> %s", sid, resp.status_code)

    def resize(self, handle: str, node_id: str, cpu: int, memory: int) -> None:
        try:
            servers = json.loads(handle).get("servers", [])
        except (json.JSONDecodeError, AttributeError):
            return
        with self._client() as c:
            target = servers[0] if len(servers) == 1 else None
            if not target:
                log.warning("多节点实例暂不支持按节点 resize，需按 node_id 维护 server 映射")
                return
            flavor = self._flavor_ref(cpu, memory, c)
            c.post(f"{self._compute_endpoint}/servers/{target}/action", json={"resize": {"flavorRef": flavor}})
            time.sleep(2)
            c.post(f"{self._compute_endpoint}/servers/{target}/action", json={"confirmResize": None})
