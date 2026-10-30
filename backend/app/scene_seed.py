"""由已有训练示例生成离线展示数据；不调用模型，不执行部署。"""
from copy import deepcopy

from .models import ComputeNode, Image, Instance, NetworkResource, ResourceContext, StorageResource, Template
from .services.extraction import EXAMPLES, CATALOG, to_scenario

TITLES = ["5G接入与核心网", "IMS语音与策略控制", "POD互联与计算", "管理网与带外管理", "无线接入与承载", "城域承载与服务"]


def seed_scenes(db):
    for example, title in zip(EXAMPLES, TITLES):
        template_id = f"tpl_demo_{example['sample_id']}"
        if db.get(Template, template_id):
            continue  # 保留用户对示例的编辑
        topology = to_scenario(deepcopy(example["output"]), example["input"], business="drill", name=title)
        topology["meta"].update(generator="example", is_demo=True, sample_id=example["sample_id"],
                                data_source="内置训练示例（非测试集）")
        db.add(Template(id=template_id, name=title, description=example["input"], business="drill",
                        industry="general", source="example", topology=topology,
                        zone_count=len(topology["zones"]), node_count=len(topology["nodes"])))
    db.flush()

    for index, (scene, catalog) in enumerate(CATALOG["scenes"].items(), 1):
        prefix = f"demo_scene_{index}"
        name = catalog["scene_name"]
        site = f"{name} · 演示资源池"
        resources = [
            ("compute", ComputeNode, dict(id=f"cmp_{prefix}", name=f"{name}演示计算节点", site=site,
                cpu_cores=64, memory_mb=262144, cpu_model="演示规格", ip="", api="", status="演示")),
            ("image", Image, dict(id=f"img_{prefix}", name=f"{name}演示镜像占位", source="演示占位（无镜像文件）",
                category="环境镜像", size_gb=0, status="演示")),
            ("storage", StorageResource, dict(id=f"stg_{prefix}", name=f"{name}演示存储", site=site,
                capacity_tb=10, used_tb=2, iops=10000, status="演示")),
            ("network", NetworkResource, dict(id=f"net_{prefix}", name=f"{name}演示网络", site=site,
                cidr="", vlan=0, bandwidth="10Gbps（演示）", total_ips=0, used_ips=0, status="演示")),
        ]
        refs = []
        for kind, model, fields in resources:
            rid = fields["id"]
            if not db.get(model, rid):
                db.add(model(**fields))
            if not db.get(ResourceContext, (kind, rid)):
                db.add(ResourceContext(kind=kind, resource_id=rid, scene_ids=[scene], data_origin="demo"))
            refs.append({"kind": kind, "id": rid})
        iid = f"ins_{prefix}"
        if not db.get(Instance, iid):
            sample = next(e for e in EXAMPLES if e["scene_id"] == scene)
            template = db.get(Template, f"tpl_demo_{sample['sample_id']}")
            nodes = []
            for node in template.topology["nodes"]:
                for i in range(node.get("quantity", 1)):
                    nodes.append({**node, "id": f"{node['id']}_{i + 1}", "name": f"{node['name']}-{i + 1}",
                                  "status": "demo", "ip": "", "ssh_port": 0, "username": "", "password": ""})
            db.add(Instance(id=iid, name=f"{name}演示实例", template_id=template.id, template_name=template.name,
                            business="drill", status="demo", stage="离线展示，未实际部署", progress=100,
                            station=site, nodes=nodes, profile={"scene": scene, "is_demo": True,
                                "resources": refs, "profile": {"name": "离线演示"}}))
    db.commit()
