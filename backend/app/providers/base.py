"""对接真实环境的驱动接口定义。

四类驱动各对应一个能力：
- ComputeProvider   创建/销毁虚机，对应 KVM、OpenStack、vSphere 等虚拟化平台
- MetricsProvider   读取节点监控指标，对应 Prometheus / Zabbix
- ResourceProvider  同步镜像与算力资源，对应 CMDB / 镜像仓库
- AlertProvider     接收外部告警，对应 Prometheus Alertmanager / 监控告警平台

所有驱动都有 mock 实现，默认走 mock；接真实环境只改环境变量（见 README「接入真实靶场」）。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol, runtime_checkable


# --------------------------------------------------------------------- 计算
@dataclass
class NodeSpec:
    """一个待创建节点的规格，来自场景模板的拓扑。"""

    id: str
    name: str
    type: str
    zone: str = ""
    image: str = ""
    flavor: str = ""
    cpu: int = 2
    memory: int = 4096
    disk: int = 40
    ip: str = ""


@dataclass
class DeploySpec:
    """一次实例化请求。"""

    instance_id: str
    name: str
    station: str
    business: str
    nodes: list[NodeSpec] = field(default_factory=list)

    @property
    def total_cpu(self) -> int:
        return sum(n.cpu for n in self.nodes)

    @property
    def total_memory(self) -> int:
        return sum(n.memory for n in self.nodes)


@dataclass
class DeployState:
    """部署状态；nodes 非空时回填真实 IP / 端口 / 账号。"""

    status: str  # provisioning / running / failed
    progress: int = 10
    stage: str = "资源申请"
    nodes: list[dict] = field(default_factory=list)
    message: str = ""


@runtime_checkable
class ComputeProvider(Protocol):
    name: str

    def deploy(self, spec: DeploySpec) -> tuple[str, DeployState]:
        """创建资源，返回 (外部句柄, 初始状态)。"""

    def poll(self, handle: str, spec: DeploySpec) -> DeployState:
        """查询部署进度。"""

    def destroy(self, handle: str) -> None:
        """销毁资源。"""

    def resize(self, handle: str, node_id: str, cpu: int, memory: int) -> None:
        """调整规格（调度建议执行时调用）。"""


# --------------------------------------------------------------------- 监控
@runtime_checkable
class MetricsProvider(Protocol):
    name: str

    def node(self, node) -> dict:
        """返回 {cpu, memory, storage, network, bandwidth_in, bandwidth_out, latency}。"""

    def history(self, node, points: int = 24, step_min: int = 5) -> list[dict]:
        """返回 [{t, cpu, memory, network}, ...]。"""


# --------------------------------------------------------------------- 资源
@runtime_checkable
class ResourceProvider(Protocol):
    name: str

    def images(self) -> list[dict]:
        """从镜像仓库/CMDB 拉取镜像清单。"""

    def compute(self) -> list[dict]:
        """从 CMDB/虚拟化平台拉取算力节点。"""

    def networks(self) -> list[dict]:
        """网络资源（可选，返回空列表表示不同步）。"""

    def storages(self) -> list[dict]:
        """存储资源（可选）。"""


# --------------------------------------------------------------------- 告警
@runtime_checkable
class AlertProvider(Protocol):
    name: str

    def pull(self) -> list[dict]:
        """主动拉取告警；webhook 方式返回空列表即可。"""


@dataclass
class Alert:
    """统一告警结构，调度中心据此生成调度事件。"""

    title: str
    instance_name: str
    node_name: str
    metric: str  # cpu / memory / network / storage
    level: str = "warning"  # info / warning / critical
    value: float = 0.0
    threshold: float = 85.0
    suggestion: str = ""
    action_label: str = "资源调整"
    instance_id: str = ""
