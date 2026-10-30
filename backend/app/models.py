from datetime import datetime

from sqlalchemy import JSON, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


def now() -> datetime:
    return datetime.now()


class Template(Base):
    __tablename__ = "templates"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    industry: Mapped[str] = mapped_column(String(64), default="general")
    business: Mapped[str] = mapped_column(String(64), default="pentest")
    zone_count: Mapped[int] = mapped_column(Integer, default=0)
    node_count: Mapped[int] = mapped_column(Integer, default=0)
    source: Mapped[str] = mapped_column(String(32), default="heuristic")
    topology: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now, onupdate=now)


class Instance(Base):
    __tablename__ = "instances"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    template_id: Mapped[str] = mapped_column(String(64), default="")
    template_name: Mapped[str] = mapped_column(String(200), default="")
    business: Mapped[str] = mapped_column(String(64), default="pentest")
    status: Mapped[str] = mapped_column(String(32), default="provisioning")
    stage: Mapped[str] = mapped_column(String(64), default="资源申请")
    progress: Mapped[int] = mapped_column(Integer, default=0)
    station: Mapped[str] = mapped_column(String(64), default="深圳（总部）资源池")
    profile: Mapped[dict] = mapped_column(JSON, default=dict)
    nodes: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now, onupdate=now)


class Image(Base):
    __tablename__ = "images"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(64), default="操作系统")
    sub_category: Mapped[str] = mapped_column(String(64), default="通用镜像")
    os_type: Mapped[str] = mapped_column(String(64), default="Linux")
    size_gb: Mapped[float] = mapped_column(Float, default=0)
    version: Mapped[str] = mapped_column(String(64), default="")
    source: Mapped[str] = mapped_column(String(64), default="通用镜像")
    status: Mapped[str] = mapped_column(String(32), default="可用")
    arch: Mapped[str] = mapped_column(String(32), default="x86_64")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class ComputeNode(Base):
    __tablename__ = "compute_nodes"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    node_type: Mapped[str] = mapped_column(String(32), default="物理机")
    cluster: Mapped[str] = mapped_column(String(64), default="")
    ip: Mapped[str] = mapped_column(String(64), default="")
    port: Mapped[int] = mapped_column(Integer, default=18000)
    os_type: Mapped[str] = mapped_column(String(64), default="Linux")
    pool: Mapped[str] = mapped_column(String(64), default="计算资源")
    domain: Mapped[str] = mapped_column(String(64), default="private")
    site: Mapped[str] = mapped_column(String(64), default="深圳（总部）资源池")
    cpu_cores: Mapped[int] = mapped_column(Integer, default=64)
    memory_mb: Mapped[int] = mapped_column(Integer, default=262144)
    cpu_model: Mapped[str] = mapped_column(String(120), default="")
    gpu_model: Mapped[str] = mapped_column(String(120), default="")
    gpu_count: Mapped[int] = mapped_column(Integer, default=0)
    gpu_mem: Mapped[int] = mapped_column(Integer, default=0)
    raid: Mapped[str] = mapped_column(String(32), default="RAID10")
    price_per_hour: Mapped[float] = mapped_column(Float, default=0)
    status: Mapped[str] = mapped_column(String(32), default="在线")
    api: Mapped[str] = mapped_column(String(200), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class StorageResource(Base):
    __tablename__ = "storage_resources"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    storage_type: Mapped[str] = mapped_column(String(32), default="分布式块存储")
    site: Mapped[str] = mapped_column(String(64), default="深圳（总部）资源池")
    capacity_tb: Mapped[float] = mapped_column(Float, default=0)
    used_tb: Mapped[float] = mapped_column(Float, default=0)
    iops: Mapped[int] = mapped_column(Integer, default=0)
    protocol: Mapped[str] = mapped_column(String(32), default="iSCSI")
    price_per_gb: Mapped[float] = mapped_column(Float, default=0)
    status: Mapped[str] = mapped_column(String(32), default="在线")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class NetworkResource(Base):
    __tablename__ = "network_resources"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    network_type: Mapped[str] = mapped_column(String(32), default="虚拟网络")
    cidr: Mapped[str] = mapped_column(String(64), default="")
    vlan: Mapped[int] = mapped_column(Integer, default=0)
    bandwidth: Mapped[str] = mapped_column(String(32), default="1Gbps")
    site: Mapped[str] = mapped_column(String(64), default="深圳（总部）资源池")
    used_ips: Mapped[int] = mapped_column(Integer, default=0)
    total_ips: Mapped[int] = mapped_column(Integer, default=254)
    status: Mapped[str] = mapped_column(String(32), default="可用")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class DispatchEvent(Base):
    __tablename__ = "dispatch_events"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    level: Mapped[str] = mapped_column(String(32), default="warning")
    title: Mapped[str] = mapped_column(String(200))
    instance_id: Mapped[str] = mapped_column(String(64), default="")
    instance_name: Mapped[str] = mapped_column(String(120), default="")
    node_name: Mapped[str] = mapped_column(String(120), default="")
    metric: Mapped[str] = mapped_column(String(32), default="memory")
    trigger_desc: Mapped[str] = mapped_column(Text, default="")
    suggestion: Mapped[str] = mapped_column(Text, default="")
    action_label: Mapped[str] = mapped_column(String(64), default="扩容")
    before: Mapped[dict] = mapped_column(JSON, default=dict)
    after: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(32), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class ResourceContext(Base):
    """资源所属场景及来源，与平台资源表解耦，兼容已有数据库。"""
    __tablename__ = "resource_contexts"

    kind: Mapped[str] = mapped_column(String(32), primary_key=True)
    resource_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    scene_ids: Mapped[list] = mapped_column(JSON, default=list)
    data_origin: Mapped[str] = mapped_column(String(32), default="registered")
