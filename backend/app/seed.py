"""首次启动时灌入演示数据（幂等）。"""

from __future__ import annotations

import random
import uuid
from datetime import datetime, timedelta

from sqlalchemy import select

from .db import SessionLocal
from .models import (
    ComputeNode,
    DispatchEvent,
    Image,
    Instance,
    NetworkResource,
    StorageResource,
    Template,
)
from .services import topology as topo
from .services.executor import build_instance_nodes
from .scene_seed import seed_scenes

TEMPLATE_SEEDS = [
    ("园区网络基础排障", "education", "drill",
     "创建一个园区办公环境，包含办公区、服务器区、运维区三个子网，核心路由器通过边界防火墙接入互联网；"
     "办公区部署6台办公电脑，服务器区部署2台服务器，运维区部署2台运维终端。"),
    ("电力调度专网攻防演练", "energy", "ad",
     "构建电力调度专网场景，包含生产控制区、运维区、外网区三个子网，生产控制区部署3台PLC设备，"
     "边界部署防火墙与入侵检测，外网区部署2台攻击终端。"),
    ("市政水务攻防演练模板", "water", "drill",
     "构建市政水务集团办公环境，包含办公区、DMZ区、内网区三个子网，DMZ区部署1台Web服务器，"
     "内网区部署2台数据库服务器，办公区部署4台办公电脑，通过核心路由器接入互联网。"),
    ("医院勒索事件响应演练", "medical", "ir",
     "构建医院信息系统环境，包含内网区、办公区、服务器区三个子网，服务器区部署3台服务器，"
     "办公区部署5台办公电脑，运维区部署1台运维终端，边界接入互联网。"),
    ("政务外网渗透测试", "government", "pentest",
     "构建政务外网渗透测试环境，包含DMZ区、内网区、外网区三个子网，DMZ区部署2台Web服务器，"
     "内网区部署2台数据库服务器，外网区部署2台攻击终端，边界部署防火墙。"),
    ("金融红蓝对抗实战演练", "finance", "drill",
     "构建金融行业红蓝对抗环境，包含办公区、服务器区、DMZ区、外网区四个子网，"
     "办公区部署4台办公电脑，服务器区部署3台服务器，DMZ区部署1台Web服务器，外网区部署2台攻击终端。"),
    ("交通信号控制网安全评估", "transport", "vuln",
     "构建交通信号控制系统场景，包含生产控制区、运维区、外网区三个子网，生产控制区部署4台PLC设备，"
     "运维区部署2台运维终端，边界部署防火墙与入侵检测，外网区接入互联网。"),
    ("高校网络安全教学实验环境", "education", "course",
     "构建高校网络安全教学实验环境，包含教学区、服务器区、外网区三个子网，教学区部署6台办公电脑，"
     "服务器区部署2台服务器，外网区部署1台攻击终端。"),
    ("工控PLC漏洞复现环境", "manufacturing", "research",
     "构建工控漏洞复现环境，包含生产控制区、内网区两个子网，生产控制区部署2台PLC设备，"
     "内网区部署2台服务器，边界部署防火墙，外网区接入互联网。"),
    ("零信任办公环境改造验证", "general", "skill",
     "构建零信任办公环境，包含办公区、内网区、DMZ区三个子网，办公区部署5台办公电脑，"
     "内网区部署2台服务器，DMZ区部署1台Web服务器，边界部署防火墙接入互联网。"),
    ("智慧园区视频专网演练", "government", "replay",
     "构建智慧园区视频专网环境，包含无线接入区、服务器区、外网区三个子网，无线接入区部署4台办公电脑，"
     "服务器区部署2台服务器，外网区部署1台攻击终端。"),
    ("水利泵站工控安全实训", "water", "course",
     "构建水利泵站工控实训环境，包含生产控制区、运维区、内网区三个子网，生产控制区部署3台PLC设备，"
     "运维区部署2台运维终端，内网区部署2台服务器。"),
]

IMAGES = [
    ("Kali 演练终端镜像", "安全工具", "渗透测试", "Kali Linux", 24, "2026.1", "通用镜像", "x86_64"),
    ("Ubuntu 22.04 演示镜像", "操作系统", "通用服务", "Ubuntu 22.04", 24, "22.04.4 LTS", "通用镜像", "x86_64"),
    ("Windows 7 企业版镜像", "操作系统", "办公终端", "Windows 7", 40, "SP1", "行业镜像", "x86_64"),
    ("DVWA 应用镜像", "应用镜像", "Web 靶场", "Linux", 2, "v1.10", "行业镜像", "x86_64"),
    ("PLC 虚拟设备镜像", "网络设备", "工控设备", "OpenPLC", 1, "v3.0", "行业镜像", "arm64"),
    ("取证分析工作站镜像", "安全工具", "电子取证", "Ubuntu 22.04", 64, "v2.4", "通用镜像", "x86_64"),
    ("Windows 10 办公终端镜像", "操作系统", "办公终端", "Windows 10", 48, "22H2", "通用镜像", "x86_64"),
    ("OpenWrt 路由器镜像", "网络设备", "路由交换", "OpenWrt", 1, "23.05", "通用镜像", "x86_64"),
    ("Snort 入侵检测镜像", "安全工具", "流量审计", "CentOS 7", 8, "3.1.0", "通用镜像", "x86_64"),
    ("MySQL 8 数据库镜像", "应用镜像", "数据服务", "Linux", 6, "8.0.36", "通用镜像", "x86_64"),
    ("Tomcat 应用服务器镜像", "应用镜像", "Web 服务", "Linux", 4, "9.0.85", "通用镜像", "x86_64"),
    ("应急响应沙箱镜像", "环境镜像", "隔离沙箱", "Linux", 32, "v1.6", "行业镜像", "x86_64"),
]

COMPUTE = [
    ("EDGE-CPU-01", "物理机", "edge-cluster-01", "10.10.10.21", "北京（边缘）资源池", 64, 262144, "Intel(R) Xeon(R) Gold 6248", "", 0, 0, 1.20, "在线"),
    ("HG-CPU-01", "虚拟机", "hg-cluster-01", "10.10.10.11", "深圳（总部）资源池", 32, 131072, "AMD EPYC 7542", "", 0, 0, 0.80, "在线"),
    ("HG-CPU-02", "虚拟机", "hg-cluster-01", "10.10.10.12", "深圳（总部）资源池", 32, 131072, "AMD EPYC 7542", "", 0, 0, 0.80, "在线"),
    ("HG-GPU-01", "物理机", "hg-gpu-cluster", "10.10.10.31", "深圳（总部）资源池", 64, 524288, "Intel Xeon Platinum 8358", "NVIDIA A100", 4, 80, 3.30, "在线"),
    ("HG-SEC-02", "物理机", "hg-sec-cluster", "10.10.10.41", "深圳（总部）资源池", 48, 196608, "Intel Xeon Gold 6348", "", 0, 0, 1.60, "在线"),
    ("LAB-CPU-01", "虚拟机", "lab-cluster-01", "10.10.10.51", "武汉（教学）资源池", 24, 98304, "AMD EPYC 7302", "", 0, 0, 0.55, "在线"),
    ("LAB-GPU-01", "物理机", "lab-gpu-cluster", "10.10.10.61", "武汉（教学）资源池", 32, 262144, "Intel Xeon Gold 5218", "NVIDIA V100", 2, 32, 2.20, "在线"),
]

STORAGE = [
    ("Ceph-BLK-01", "分布式块存储", "深圳（总部）资源池", 512, 268, 120000, "iSCSI", 0.0006),
    ("Ceph-BLK-02", "分布式块存储", "北京（边缘）资源池", 256, 96, 80000, "iSCSI", 0.0007),
    ("NFS-SHARE-01", "共享文件存储", "深圳（总部）资源池", 128, 74, 30000, "NFS", 0.0004),
    ("OSS-ARCHIVE-01", "对象存储", "武汉（教学）资源池", 1024, 412, 20000, "S3", 0.0002),
]

NETWORK = [
    ("core-transit", "虚拟网络", "10.0.0.0/24", 100, "10Gbps", "深圳（总部）资源池", 46, 254),
    ("office-seg", "虚拟网络", "10.0.1.0/24", 110, "1Gbps", "深圳（总部）资源池", 88, 254),
    ("dmz-seg", "虚拟网络", "10.0.2.0/24", 120, "1Gbps", "深圳（总部）资源池", 24, 254),
    ("lab-seg", "虚拟网络", "10.0.3.0/24", 210, "1Gbps", "武汉（教学）资源池", 132, 254),
    ("edge-uplink", "专线通道", "172.16.8.0/29", 300, "200Mbps", "北京（边缘）资源池", 4, 8),
]


def _instances(db) -> None:
    templates = db.execute(select(Template).order_by(Template.created_at)).scalars().all()
    picks = [
        ("医院办公场景", templates[3], "ir", "深圳（总部）资源池"),
        ("私有水务红蓝对抗复盘", templates[2], "drill", "北京（边缘）资源池"),
        ("园区网络基础排障", templates[0], "drill", "武汉（教学）资源池"),
        ("政务日志审计实训", templates[4], "pentest", "深圳（总部）资源池"),
    ]
    for i, (name, tpl, biz, station) in enumerate(picks):
        if tpl is None:
            continue
        nodes = build_instance_nodes(tpl.topology)
        for n in nodes:
            n["status"] = "running"
        db.add(Instance(
            id=f"ins_seed{i + 1}",
            name=name,
            template_id=tpl.id,
            template_name=tpl.name,
            business=biz,
            status="running" if i != 3 else "provisioning",
            stage="就绪" if i != 3 else "镜像分发",
            progress=100 if i != 3 else 45,
            station=station,
            profile={"profile": {"id": "training_education", "name": "教学实训", "cpu": 2, "memory": 4096}},
            nodes=nodes,
            created_at=datetime.now() - timedelta(days=2, hours=i),
        ))


def _events(db) -> None:
    db.add(DispatchEvent(
        id="evt_1",
        level="warning",
        title="虚拟机 医院办公场景 业务应用服务器 内存扩容建议",
        instance_id="ins_seed1",
        instance_name="医院办公场景",
        node_name="服务器区服务器-2",
        metric="memory",
        trigger_desc="内存使用率连续 15 分钟高于 85%，已出现 3 次 swap 抖动；同时网络出口带宽利用率 100%，疑似勒索病毒横向扫描导致连接堆积。",
        suggestion="建议对该节点内存扩容 4GB，并将出口带宽从 1Gbps 提升至 2Gbps，预计可消除排队。",
        action_label="内存扩容",
        before={"cpu": 56, "memory": 88, "storage": 12, "network": 100},
        after={"cpu": 40, "memory": 44, "storage": 12, "network": 94},
        created_at=datetime.now() - timedelta(minutes=18),
    ))
    db.add(DispatchEvent(
        id="evt_2",
        level="info",
        title="虚拟机 私有水务红蓝对抗复盘 红队终端 资源降配建议",
        instance_id="ins_seed2",
        instance_name="私有水务红蓝对抗复盘",
        node_name="外网终端-1",
        metric="cpu",
        trigger_desc="该终端 CPU 使用率连续 3 天低于 8%，内存占用长期低于 30%，存在资源闲置。",
        suggestion="建议将规格从 4C8G 降配为 2C4G，预计每小时节省 0.42 元。",
        action_label="资源降配",
        before={"cpu": 6, "memory": 28, "storage": 41, "network": 12},
        after={"cpu": 11, "memory": 46, "storage": 41, "network": 12},
        created_at=datetime.now() - timedelta(hours=3),
    ))
    db.add(DispatchEvent(
        id="evt_3",
        level="critical",
        title="边缘资源池 CPU 水位过高，建议迁移 2 个实例至总部",
        instance_id="ins_seed2",
        instance_name="私有水务红蓝对抗复盘",
        node_name="EDGE-CPU-01",
        metric="cpu",
        trigger_desc="北京（边缘）资源池 CPU 平均水位 82%，超过 75% 阈值，且该池仅剩 3 个节点可调度。",
        suggestion="建议将 2 个非实时实例迁移至深圳（总部）资源池，预计 CPU 水位下降至 58%。",
        action_label="跨池迁移",
        before={"cpu": 82, "memory": 74, "storage": 55, "network": 68},
        after={"cpu": 58, "memory": 63, "storage": 55, "network": 61},
        created_at=datetime.now() - timedelta(hours=1),
    ))


def seed() -> None:
    db = SessionLocal()
    try:
        if db.execute(select(Template)).scalars().first() is not None:
            seed_scenes(db)
            return

        for name, industry, business, desc in TEMPLATE_SEEDS:
            scenario = topo.build_scenario(desc, industry, business, name=name)
            db.add(Template(
                id=f"tpl_{uuid.uuid4().hex[:8]}",
                name=name,
                description=desc,
                industry=industry,
                business=business,
                zone_count=len(scenario["zones"]),
                node_count=len(scenario["nodes"]),
                source="rule-engine",
                topology=scenario,
                created_at=datetime.now() - timedelta(days=random.randint(1, 40)),
            ))

        for name, cat, sub, os_type, size, ver, src, arch in IMAGES:
            db.add(Image(
                id=f"img_{uuid.uuid4().hex[:8]}",
                name=name, category=cat, sub_category=sub, os_type=os_type,
                size_gb=size, version=ver, source=src, status="可用", arch=arch,
                created_at=datetime.now() - timedelta(days=random.randint(1, 30)),
            ))

        for name, ntype, cluster, ip, site, cores, mem, model, gpu, gcount, gmem, price, status in COMPUTE:
            db.add(ComputeNode(
                id=f"cmp_{uuid.uuid4().hex[:8]}",
                name=name, node_type=ntype, cluster=cluster, ip=ip, port=18000,
                os_type="Linux", pool="计算资源", domain="private", site=site,
                cpu_cores=cores, memory_mb=mem, cpu_model=model, gpu_model=gpu,
                gpu_count=gcount, gpu_mem=gmem, raid="RAID10", price_per_hour=price,
                status=status, api=f"http://{ip}:18000/api/v1",
                created_at=datetime.now() - timedelta(days=12),
            ))

        for name, stype, site, cap, used, iops, proto, price in STORAGE:
            db.add(StorageResource(
                id=f"stg_{uuid.uuid4().hex[:8]}",
                name=name, storage_type=stype, site=site, capacity_tb=cap, used_tb=used,
                iops=iops, protocol=proto, price_per_gb=price, status="在线",
                created_at=datetime.now() - timedelta(days=20),
            ))

        for name, ntype, cidr, vlan, bw, site, used, total in NETWORK:
            db.add(NetworkResource(
                id=f"net_{uuid.uuid4().hex[:8]}",
                name=name, network_type=ntype, cidr=cidr, vlan=vlan, bandwidth=bw,
                site=site, used_ips=used, total_ips=total, status="可用",
                created_at=datetime.now() - timedelta(days=20),
            ))

        db.commit()
        _instances(db)
        _events(db)
        db.commit()
        # 旧演示数据也记录来源，避免被视为真实平台资源。
        from .models import ResourceContext
        for kind, model in (("image", Image), ("compute", ComputeNode), ("storage", StorageResource), ("network", NetworkResource)):
            for resource in db.scalars(select(model)):
                db.add(ResourceContext(kind=kind, resource_id=resource.id, scene_ids=[], data_origin="demo"))
        for inst in db.scalars(select(Instance)):
            inst.profile = {**inst.profile, "is_demo": True}
        db.commit()
        seed_scenes(db)
    finally:
        db.close()
