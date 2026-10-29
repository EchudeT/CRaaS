"""Natural-language facts -> validated extraction -> editable logical graph."""
from __future__ import annotations

from copy import deepcopy
import json
from pathlib import Path
import re

from jsonschema import Draft202012Validator

from .llm_client import ModelError, call_model

ASSETS = Path(__file__).resolve().parents[1] / "assets" / "topology"


def asset(name):
    return json.loads((ASSETS / name).read_text(encoding="utf-8"))


CATALOG = asset("catalog.json")
EXAMPLES = asset("examples.json")["examples"]
CATEGORIES = asset("categories.json")
VALIDATOR = Draft202012Validator(asset("schema.json"))
SYSTEM = (ASSETS / "system_prompt.txt").read_text(encoding="utf-8")
COLORS = ["#0072CE", "#6D5BD0", "#0E7C86", "#D98324", "#B5179E", "#1F9E62", "#0891B2"]


def scenes():
    return [{"id": sid, "name": scene["scene_name"]} for sid, scene in CATALOG["scenes"].items()]


def scene_hint(text):
    lower = text.lower()
    scores = {}
    for sid, scene in CATALOG["scenes"].items():
        score = 100 if scene["scene_name"].lower() in lower else 0
        for entity in scene["entities"]:
            for alias in entity["aliases"]:
                if len(alias) >= 2 and alias.lower() in lower:
                    score += 3 if len(alias) >= 4 else 1
        scores[sid] = score
    return max(scores, key=scores.get)


def build_prompt(text, scene_id="auto"):
    sid = scene_hint(text) if scene_id == "auto" else scene_id
    if sid not in CATALOG["scenes"]:
        raise ValueError("不支持的网络场景")
    scene = CATALOG["scenes"][sid]
    candidates = [e for e in EXAMPLES if e["scene_id"] == sid]
    example = max(candidates, key=lambda e: sum(k.lower() in text.lower() for k in e["keywords"]))
    guide = {"scene_id": sid, "scene_name": scene["scene_name"], "entity_types": scene["entities"],
             "relation_types": scene["relation_types"]}
    extra = """
这是事实抽取任务，不是补全设计。不得添加原文没有的互联网、网关、IP、镜像、规格或连接。
不限制实体数量；逐段保留所有明确出现的实体和关系。category 使用目录中的 category_id。
接口、协议、光纤不是独立实体。同一实体多个实例数量记为 quantity；不同部署地点分别建实体。
evidence 引用原文短句。原文未提供的属性省略，禁止套用示例属性。
保留关系的方向、relation_type、接口和协议，不要将管理、认证、承载关系改成物理连线。
关系增加 bandwidth 字符串：原文明示100GE、10GE链路时分别填100Gbps、10Gbps，未指定则填空字符串。
链路速率与具体接口、端口编号、协议分别记录；未提供后几项不影响提取速率，不必为缺少这些可选信息生成未解决提示。
interface 可保留原文链路名称（如100GE链路）；不得猜测端口编号。设备形态、层级等实际歧义仍应保留。
只抽取原文实际出现的类型，不要输出整个目录。未知或歧义信息写入 unresolved_items。
如果没有足够事实生成支持场景，说明不确定项，不得套用示例网络。
"""
    return "\n".join([SYSTEM, extra, "当前场景目录：", json.dumps(guide, ensure_ascii=False),
                      "训练集示例（不复制与当前需求无关的事实）：", example["input"],
                      json.dumps(example["output"], ensure_ascii=False)])


def parse_and_validate(content):
    text = content.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text).strip()
    try:
        try:
            value = json.loads(text)
        except json.JSONDecodeError:
            value = json.loads(text[text.index("{"):text.rindex("}") + 1])
    except (ValueError, TypeError):
        return None, ["输出不是合法 JSON 对象"]
    errors = [f"{list(e.absolute_path)}: {e.message}" for e in VALIDATOR.iter_errors(value)]
    if errors:
        return value, errors[:20]
    allowed_scenes = [value["primary_scene"], *value["secondary_scenes"]]
    types = {e["entity_type_id"] for sid in allowed_scenes for e in CATALOG["scenes"].get(sid, {}).get("entities", [])}
    ids = [e["instance_id"] for e in value["entities"]]
    if len(ids) != len(set(ids)):
        errors.append("instance_id 不得重复")
    for entity in value["entities"]:
        if entity["entity_type_id"] not in types:
            errors.append("实体类型不属于场景目录：" + entity["entity_type_id"])
    keys = set()
    for relation in value["relations"]:
        if relation["source"] not in ids or relation["target"] not in ids:
            errors.append("关系端点引用不存在的实体")
        if relation["source"] == relation["target"]:
            errors.append("关系不得连接自身")
        key = tuple(relation[k] for k in ("source", "target", "relation_type", "interface", "protocol"))
        if key in keys:
            errors.append("关系重复")
        keys.add(key)
    return value, errors[:20]


def display_type(entity):
    if entity.get("category") == "ptn_transport_network":
        return "transport"
    text = " ".join(str(entity.get(k, "")) for k in (
        "canonical_name", "raw_name", "name", "category",
    )).lower()
    if any(x in text for x in ("firewall", "防火墙", "waf")):
        return "firewall"
    if any(x in text for x in ("switch", "交换机", "tor", "spine", "leaf")):
        return "switch"
    if any(x in text for x in ("router", "路由", "网关", "gateway")) or re.search(r"(?:^|\s)(?:ce|ecr)(?:\s|$)", text):
        return "router"
    if "_ids" in entity.get("entity_type_id", "").lower() or "入侵检测" in text:
        return "ids"
    if entity.get("entity_type_id") == "CN_UE" or any(x in text for x in ("终端", "工作站", "client")) or re.search(r"(?:^|\s)ue(?:\s|$)", text):
        return "pc"
    if any(x in text for x in ("网络域", "承载网", "传送网", "资源池", "network_domain", "cloud_network")):
        return "cloud"
    return "server"


def to_scenario(extraction, description, industry="general", business="pentest", name=None, model=""):
    zones, nodes, links = [], [], []
    groups = {}
    for entity in extraction["entities"]:
        category = entity["category"]
        if category not in groups:
            category_name = next((c[category] for c in CATEGORIES.values() if category in c), category)
            zone = {"id": "zone_" + category, "name": category_name, "cidr": "", "color": COLORS[len(zones) % len(COLORS)]}
            zones.append(zone)
            groups[category] = zone
        attrs = entity["attributes"]
        interface_value = attrs.get("interfaces") or attrs.get("interface") or []
        interfaces = (list(interface_value) if isinstance(interface_value, list) else
                      [part.strip() for part in re.split(r"[、,，/]", str(interface_value)) if part.strip()])
        nodes.append({
            "id": entity["instance_id"], "name": entity["canonical_name"], "type": display_type(entity),
            "zone": groups[category]["id"], "ip": str(attrs.get("management_ip") or attrs.get("ip") or ""),
            "image": "", "flavor": "", "cpu": 0, "memory": 0, "disk": 0, "ports": 0,
            "role": entity["canonical_name"], "status": "planned",
            "canonical_name": entity["canonical_name"], "interfaces": interfaces,
            **{k: entity[k] for k in ("entity_type_id", "quantity", "attributes", "raw_name", "category", "evidence", "confidence")},
        })
    for i, relation in enumerate(extraction["relations"]):
        bandwidth = relation.get("bandwidth", "")
        label_parts = list(dict.fromkeys(value for value in (
            relation["interface"], relation["protocol"], bandwidth,
        ) if value))
        links.append({
            "id": f"relation_{i + 1}", **relation, "src_port": "", "dst_port": "", "cidr": "", "bandwidth": bandwidth,
            "label": " · ".join(label_parts) or relation["relation_type"],
            "directed": relation.get("directed") is not False,
        })
    return {
        "schema_version": "2.0", "kind": "logical", "name": name or extraction["primary_scene_name"],
        "description": description, "industry": industry, "business": business,
        "zones": zones, "nodes": nodes, "links": links,
        "meta": {"generator": "llm", "model": model, "scene": extraction["primary_scene"],
                 "secondary_scenes": list(extraction["secondary_scenes"]), "scene_confidence": extraction["scene_confidence"],
                 "scene_name": extraction["primary_scene_name"], "zone_count": len(zones), "node_count": len(nodes),
                 "link_count": len(links), "host_count": sum(n["quantity"] for n in nodes),
                 "unresolved_items": extraction["unresolved_items"], "deployment_ready": False},
    }


async def generate(description, industry, business, name, scene_id, config, progress=None):
    system = build_prompt(description, scene_id)
    messages = [{"role": "user", "content": description}]
    for attempt in range(2):
        if progress:
            progress("repairing" if attempt else "generating", 0)
        def streamed(chars):
            if progress:
                progress("repairing" if attempt else "generating", chars)
        content, _usage = await call_model(config, system, messages, streamed)
        extraction, errors = parse_and_validate(content)
        if not errors:
            from .topology import validate_topology
            scenario = to_scenario(extraction, description, industry, business, name, config.model)
            return {"scenario": scenario, "validation": validate_topology(scenario), "generator": "llm",
                    "model": config.model, "repair_attempted": bool(attempt),
                    "extraction": deepcopy(extraction), "raw_analysis": content}
        if attempt == 0:
            messages += [{"role": "assistant", "content": content},
                         {"role": "user", "content": "修复以下错误并返回完整 JSON，保持原文事实：\n" + json.dumps(errors, ensure_ascii=False)}]
    raise ModelError("模型结果在一次修复后仍未通过结构校验，请补充或简化描述后重试")


def validate_logical(scenario):
    issues = []
    nodes, links, zones = scenario.get("nodes", []), scenario.get("links", []), scenario.get("zones", [])
    ids = [n.get("id") for n in nodes]
    zone_ids = {z.get("id") for z in zones}
    def issue(level, code, message, node_id=""):
        issues.append({"level": level, "code": code, "message": message, "node_id": node_id})
    if not nodes:
        issue("error", "EMPTY", "场景中没有实体")
    if len(ids) != len(set(ids)) or any(not i for i in ids):
        issue("error", "NODE_ID", "节点 ID 缺失或重复")
    degree = dict.fromkeys(ids, 0)
    for link in links:
        if link.get("source") not in degree or link.get("target") not in degree:
            issue("error", "ENDPOINT", "关系引用了不存在的节点")
        elif link["source"] == link["target"]:
            issue("error", "SELF_LINK", "关系不能连接自身", link["source"])
        else:
            degree[link["source"]] += 1
            degree[link["target"]] += 1
    for node in nodes:
        if node.get("zone") not in zone_ids:
            issue("error", "ZONE", "节点引用了不存在的分组", node.get("id", ""))
        quantity = node.get("quantity", 1)
        if isinstance(quantity, bool) or not isinstance(quantity, int) or quantity < 1:
            issue("error", "QUANTITY", "实体数量必须是正整数", node.get("id", ""))
        if not degree.get(node.get("id")):
            issue("warn", "NO_RELATION", f"{node.get('name', '')} 当前抽取结果中没有关联关系，请核对原文与抽取结果", node.get("id", ""))
    for unresolved in scenario.get("meta", {}).get("unresolved_items", []):
        issue("warn", "UNRESOLVED", str(unresolved))
    errors = sum(i["level"] == "error" for i in issues)
    return {"issues": issues, "error_count": errors, "warn_count": len(issues) - errors, "passed": errors == 0,
            "stats": {"zones": len(zones), "nodes": len(nodes), "links": len(links),
                      "subnets": len({z.get("cidr") for z in zones if z.get("cidr")})}}
