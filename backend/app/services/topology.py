"""拓扑生成与校验：规则引擎（离线可用）+ LLM 结果归一化。"""

from __future__ import annotations

import ipaddress
import re
import uuid

CN_NUM = {
    "一": 1, "二": 2, "两": 2, "三": 3, "四": 4, "五": 5,
    "六": 6, "七": 7, "八": 8, "九": 9, "十": 10,
}

ZONE_CATALOG: list[tuple[str, str, list[str], str]] = [
    ("internet", "外网区", ["外网", "互联网", "公网", "internet", "出口区"], "#3A93DE"),
    ("internal", "内网区", ["内网", "内部网络", "核心业务区"], "#0E7C86"),
    ("office", "办公区", ["办公区", "办公", "办公室", "终端区"], "#0072CE"),
    ("server", "服务器区", ["服务器区", "server区", "服务器", "机房", "数据中心"], "#6D5BD0"),
    ("ops", "运维区", ["运维区", "运维", "管理区", "网管"], "#D98324"),
    ("dmz", "DMZ区", ["dmz", "隔离区"], "#B5179E"),
    ("ot", "生产控制区", ["生产控制", "工控", "ot区", "调度中心", "调度"], "#C2410C"),
    ("teach", "教学区", ["教学区", "教学", "实验区", "靶场教学"], "#1F9E62"),
    ("wireless", "无线接入区", ["无线", "wifi", "wi-fi"], "#0891B2"),
    ("cloud", "云资源区", ["云资源", "专有云", "云上", "私有云"], "#2563EB"),
]

NODE_LIB = {
    "router": {"image": "router-vr-8", "flavor": "4C8G", "cpu": 4, "memory": 8192, "disk": 8, "ports": 8, "label": "路由器"},
    "switch": {"image": "switch-vs-8", "flavor": "2C4G", "cpu": 2, "memory": 4096, "disk": 8, "ports": 8, "label": "交换机"},
    "firewall": {"image": "fw-ngfw-4", "flavor": "4C8G", "cpu": 4, "memory": 8192, "disk": 16, "ports": 6, "label": "防火墙"},
    "server": {"image": "ubuntu-2204-server", "flavor": "4C8G", "cpu": 4, "memory": 8192, "disk": 100, "ports": 2, "label": "服务器"},
    "pc": {"image": "win10-office", "flavor": "2C4G", "cpu": 2, "memory": 4096, "disk": 60, "ports": 1, "label": "办公终端"},
    "kali": {"image": "kali-2024-attacker", "flavor": "2C4G", "cpu": 2, "memory": 4096, "disk": 80, "ports": 1, "label": "攻击终端"},
    "plc": {"image": "plc-s7-1200", "flavor": "1C1G", "cpu": 1, "memory": 1024, "disk": 8, "ports": 2, "label": "PLC 设备"},
    "ids": {"image": "ids-snort-3", "flavor": "2C4G", "cpu": 2, "memory": 4096, "disk": 40, "ports": 2, "label": "入侵检测"},
    "cloud": {"image": "cloud-internet", "flavor": "-", "cpu": 0, "memory": 0, "disk": 0, "ports": 1, "label": "互联网"},
}

ZONE_HOST_TYPE = {
    "office": "pc",
    "server": "server",
    "internal": "server",
    "ops": "pc",
    "dmz": "server",
    "ot": "plc",
    "teach": "pc",
    "wireless": "pc",
    "cloud": "server",
    "internet": "pc",
}

PRESET_DESCRIPTIONS = [
    (
        "园区网络基础排障",
        "创建一个园区办公环境，包含办公区、服务器区、运维区三个子网，核心路由器通过边界防火墙接入互联网；"
        "办公区部署6台办公电脑，服务器区部署2台服务器，运维区部署2台运维终端。",
    ),
    (
        "电力调度专网攻防演练",
        "构建电力调度专网场景，包含生产控制区、运维区、外网区三个子网，生产控制区部署3台PLC设备，"
        "边界部署防火墙与入侵检测，外网区部署2台攻击终端。",
    ),
    (
        "市政水务攻防演练模板",
        "构建市政水务集团办公环境，包含办公区、DMZ区、内网区三个子网，DMZ区部署1台Web服务器，"
        "内网区部署2台数据库服务器，办公区部署4台办公电脑，通过核心路由器接入互联网。",
    ),
    (
        "医院勒索事件响应演练",
        "构建医院信息系统环境，包含内网区、办公区、服务器区三个子网，服务器区部署3台服务器，"
        "办公区部署5台办公电脑，运维区部署1台运维终端，边界接入互联网。",
    ),
]


# ---------------------------------------------------------------- helpers
def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


def _parse_cidrs(text: str) -> list[str]:
    raw = re.findall(r"\b\d{1,3}(?:\.\d{1,3}){3}(?:/\d{1,2})?\b", text)
    out: list[str] = []
    for item in raw:
        cidr = item if "/" in item else f"{item}/24"
        try:
            net = ipaddress.ip_network(cidr, strict=False)
        except ValueError:
            continue
        if str(net) not in out:
            out.append(str(net))
    return out


def _to_int(token: str) -> int:
    if token.isdigit():
        return int(token)
    if token in CN_NUM:
        return CN_NUM[token]
    if token.startswith("十"):
        return 10 + CN_NUM.get(token[1:], 0) if len(token) > 1 else 10
    return 1


def _count_near(text: str, idx: int, default: int | None) -> int | None:
    """在同一个小句内找"6台办公电脑"这类数量描述（不跨分句，避免误抓）。"""
    end = len(text)
    for sep in ("，", "。", "；", ";", "\n", "、"):
        p = text.find(sep, idx + 1)
        if p >= 0:
            end = min(end, p)
    window = text[idx:end]
    for m in re.finditer(r"(\d+|[一二两三四五六七八九十])\s*(台|部|个)\s*([\u4e00-\u9fa5A-Za-z]{0,4})", window):
        tail = m.group(3) or ""
        if any(k in tail for k in ("子网", "网段", "区域", "机房", "核心", "路由器", "交换机", "防火墙")):
            continue
        value = _to_int(m.group(1))
        if 1 <= value <= 40:
            return min(value, 6)
    return default


def _best_count(text: str, positions: list[int], default: int) -> int:
    """同一区域可能在文中出现多次，取第一个带数量的小句。"""
    for p in positions:
        found = _count_near(text, p, None)
        if found is not None:
            return found
    return default


def _host_ip(cidr: str, offset: int) -> str:
    try:
        net = ipaddress.ip_network(cidr, strict=False)
    except ValueError:
        return f"10.0.{offset}.10"
    try:
        return str(net.network_address + offset)
    except (ValueError, IndexError):
        return f"10.0.{offset}.10"


def node(kind: str, name: str, zone: str, ip: str, role: str = "") -> dict:
    lib = NODE_LIB[kind]
    return {
        "id": new_id("n"),
        "name": name,
        "type": kind,
        "zone": zone,
        "ip": ip,
        "image": lib["image"],
        "flavor": lib["flavor"],
        "cpu": lib["cpu"],
        "memory": lib["memory"],
        "disk": lib["disk"],
        "ports": lib["ports"],
        "role": role or lib["label"],
        "status": "running",
    }


def link(src: dict, dst: dict, src_port: str, dst_port: str, cidr: str = "", bw: str = "1Gbps") -> dict:
    return {
        "id": new_id("l"),
        "source": src["id"],
        "target": dst["id"],
        "src_port": src_port,
        "dst_port": dst_port,
        "cidr": cidr,
        "bandwidth": bw,
    }


# ---------------------------------------------------------------- builder
def build_scenario(
    description: str,
    industry: str = "general",
    business: str = "pentest",
    name: str | None = None,
) -> dict:
    """规则引擎：从自然语言中抽取区域、节点数量与网段，生成可直接渲染的拓扑。"""
    text = description.strip()
    if not text:
        text = PRESET_DESCRIPTIONS[0][1]
    lower = text.lower()

    parsed = _parse_cidrs(text)
    # /30 这类小网段用于互联链路，/24 及更大才分给业务区域
    big_cidrs = [c for c in parsed if ipaddress.ip_network(c).prefixlen <= 24]
    wan_cidrs = [c for c in parsed if ipaddress.ip_network(c).prefixlen > 24]

    # 1) 识别区域（按首次出现顺序，保留全部出现位置用于抽取数量）
    hits: list[tuple[int, str, str, str, list[int]]] = []
    for key, zname, kws, color in ZONE_CATALOG:
        positions: list[int] = []
        for kw in kws:
            start = 0
            while True:
                p = lower.find(kw, start)
                if p < 0:
                    break
                positions.append(p)
                start = p + 1
        if positions:
            hits.append((min(positions), key, zname, color, sorted(set(positions))))
    hits.sort(key=lambda x: x[0])

    if not hits:
        for key, zname, _kws, color in ZONE_CATALOG:
            if key in ("office", "server", "internal"):
                hits.append((99, key, zname, color, []))
        hits.sort(key=lambda x: x[0])

    # 最多 6 个区域，保证画布可读
    hits = hits[:6]

    zones: list[dict] = []
    if big_cidrs:
        edge_cidr = big_cidrs[0]
    elif wan_cidrs:
        edge_cidr = _free_cidr(wan_cidrs)
    else:
        edge_cidr = "10.0.0.0/24"
    wan_link = wan_cidrs[0] if wan_cidrs else edge_cidr
    zone_pool = [c for c in big_cidrs if c != edge_cidr]
    zones.append({"id": "zone_edge", "name": "边界接入区", "cidr": edge_cidr, "color": "#00508F"})

    nodes: list[dict] = []
    links: list[dict] = []

    core = node("router", "核心路由器", "zone_edge", _host_ip(edge_cidr, 1), "核心路由")
    fw = node("firewall", "边界防火墙", "zone_edge", _host_ip(edge_cidr, 2), "边界防护")
    internet = node("cloud", "互联网", "zone_edge", "—", "互联网出口")
    nodes += [core, fw, internet]
    links.append(link(core, fw, "GE0/1", "GE0/1", wan_link))
    links.append(link(fw, internet, "GE0/2", "GE0/2", wan_link))

    need_ids = any(k in text for k in ("入侵检测", "审计", "态势", "ids", "ips"))
    if need_ids:
        ids = node("ids", "入侵检测探针", "zone_edge", _host_ip(edge_cidr, 3), "流量审计")
        nodes.append(ids)
        links.append(link(fw, ids, "GE0/3", "GE0/1", wan_link))

    for idx, (_pos, key, zname, color, positions) in enumerate(hits):
        zone_id = f"zone_{key}"
        if any(z["id"] == zone_id for z in zones):
            continue
        used_cidrs = [z["cidr"] for z in zones]
        cidr = next((c for c in zone_pool if c not in used_cidrs), None) or _free_cidr(used_cidrs)
        zones.append({"id": zone_id, "name": zname, "cidr": cidr, "color": color})

        sw = node("switch", f"{zname}接入交换机", zone_id, _host_ip(cidr, 2), "区域汇聚")
        nodes.append(sw)
        links.append(link(core, sw, f"GE0/{idx + 3}", "GE0/1", cidr))

        if key == "internet":
            # 外网区用一台跳板/攻击终端代表外网可访问角色
            count = min(_best_count(text, positions, 1), 2)
            host_kind = "kali"
            for i in range(count):
                h = node(host_kind, f"外网终端-{i + 1}", zone_id, _host_ip(cidr, 10 + i), "外网终端")
                nodes.append(h)
                links.append(link(sw, h, f"GE0/{i + 2}", "eth0", cidr))
            continue

        count = _best_count(text, positions, 2)
        host_kind = ZONE_HOST_TYPE.get(key, "pc")
        for i in range(count):
            if host_kind == "server":
                hname = f"{zname}服务器-{i + 1}"
            elif host_kind == "plc":
                hname = f"PLC-{i + 1}"
            elif host_kind == "pc" and key == "ops":
                hname = f"运维终端-{i + 1}"
            else:
                hname = f"办公终端-{i + 1}"
            h = node(host_kind, hname, zone_id, _host_ip(cidr, 10 + i))
            nodes.append(h)
            links.append(link(sw, h, f"GE0/{i + 2}", "eth0", cidr))

    if name:
        title = name
    else:
        head = re.split(r"[，。；,;]", text)[0].strip()
        title = head[:18] + ("…" if len(head) > 18 else "")

    return {
        "name": title or "未命名场景",
        "description": description,
        "industry": industry,
        "business": business,
        "zones": zones,
        "nodes": nodes,
        "links": links,
        "meta": {
            "generator": "rule-engine",
            "zone_count": len(zones),
            "node_count": len(nodes),
            "link_count": len(links),
            "host_count": sum(1 for n in nodes if n["type"] in ("pc", "server", "plc", "kali")),
        },
    }


def _free_cidr(used: list[str]) -> str:
    used_nets = []
    for c in used:
        try:
            used_nets.append(ipaddress.ip_network(c, strict=False))
        except ValueError:
            continue
    for third in range(1, 60):
        cand = ipaddress.ip_network(f"10.0.{third}.0/24", strict=False)
        if not any(cand.overlaps(u) for u in used_nets):
            return str(cand)
    return "10.9.9.0/24"


def _host_ip_cidr(base_cidr: str, index: int) -> str:
    try:
        net = ipaddress.ip_network(base_cidr, strict=False)
        third = index
        parts = str(net.network_address).split(".")
        return f"{parts[0]}.{parts[1]}.{third}.0/24"
    except ValueError:
        return f"10.0.{index}.0/24"


# ---------------------------------------------------------------- validator
def validate_topology(scenario: dict) -> dict:
    if scenario.get("kind") == "logical":
        from .extraction import validate_logical
        return validate_logical(scenario)
    issues: list[dict] = []
    nodes = scenario.get("nodes", [])
    links = scenario.get("links", [])
    zones = {z["id"]: z for z in scenario.get("zones", [])}

    seen_ip: dict[str, str] = {}
    degree: dict[str, int] = {n["id"]: 0 for n in nodes}
    for l in links:
        degree[l["source"]] = degree.get(l["source"], 0) + 1
        degree[l["target"]] = degree.get(l["target"], 0) + 1

    for n in nodes:
        ip = n.get("ip", "")
        if ip and ip != "—":
            if ip in seen_ip:
                issues.append({
                    "level": "error",
                    "code": "IP_CONFLICT",
                    "message": f"IP 冲突：{n['name']} 与 {seen_ip[ip]} 均使用 {ip}",
                    "node_id": n["id"],
                })
            seen_ip[ip] = n["name"]
            zone = zones.get(n.get("zone", ""))
            if zone and "/" in zone.get("cidr", ""):
                try:
                    if ipaddress.ip_address(ip) not in ipaddress.ip_network(zone["cidr"], strict=False):
                        issues.append({
                            "level": "error",
                            "code": "OUT_OF_SUBNET",
                            "message": f"{n['name']} 的地址 {ip} 不在 {zone['name']} 网段 {zone['cidr']} 内",
                            "node_id": n["id"],
                        })
                except ValueError:
                    issues.append({
                        "level": "warn",
                        "code": "BAD_IP",
                        "message": f"{n['name']} 的地址格式非法：{ip}",
                        "node_id": n["id"],
                    })

        if n["type"] != "cloud" and degree.get(n["id"], 0) == 0:
            issues.append({
                "level": "error",
                "code": "ISOLATED",
                "message": f"{n['name']} 未连接任何链路（孤岛节点）",
                "node_id": n["id"],
            })
        if degree.get(n["id"], 0) > n.get("ports", 8):
            issues.append({
                "level": "warn",
                "code": "PORT_OVERFLOW",
                "message": f"{n['name']} 链路数 {degree[n['id']]} 超过端口数 {n['ports']}",
                "node_id": n["id"],
            })

    for z in scenario.get("zones", []):
        members = [n for n in nodes if n.get("zone") == z["id"]]
        if not members:
            issues.append({
                "level": "warn",
                "code": "EMPTY_ZONE",
                "message": f"{z['name']} 为空区域，未分配任何节点",
                "node_id": "",
            })
        elif not any(m["type"] in ("switch", "router", "firewall") for m in members):
            issues.append({
                "level": "warn",
                "code": "NO_GATEWAY",
                "message": f"{z['name']} 缺少汇聚/网关设备",
                "node_id": "",
            })

    errors = sum(1 for i in issues if i["level"] == "error")
    return {
        "issues": issues,
        "error_count": errors,
        "warn_count": len(issues) - errors,
        "passed": errors == 0,
        "stats": {
            "zones": len(scenario.get("zones", [])),
            "nodes": len(nodes),
            "links": len(links),
            "subnets": len({z.get("cidr") for z in scenario.get("zones", []) if z.get("cidr")}),
        },
    }


# ---------------------------------------------------------------- normalize
def normalize(raw: dict, description: str, industry: str, business: str) -> dict:
    """把 LLM 返回的结构补齐成前端/执行器可用的稳定结构。"""
    zones_raw = raw.get("zones") or []
    zones: list[dict] = []
    color_pool = ["#0072CE", "#6D5BD0", "#0E7C86", "#D98324", "#B5179E", "#1F9E62", "#0891B2"]
    for i, z in enumerate(zones_raw):
        zid = str(z.get("id") or f"zone_{i + 1}")
        zones.append({
            "id": zid,
            "name": str(z.get("name") or f"区域{i + 1}"),
            "cidr": str(z.get("cidr") or f"10.0.{i}.0/24"),
            "color": str(z.get("color") or color_pool[i % len(color_pool)]),
        })
    if not zones:
        zones = [{"id": "zone_default", "name": "默认区域", "cidr": "10.0.0.0/24", "color": "#0072CE"}]
    zone_ids = {z["id"] for z in zones}

    nodes: list[dict] = []
    for i, n in enumerate(raw.get("nodes") or []):
        kind = str(n.get("type") or "server").lower()
        if kind not in NODE_LIB:
            kind = "server"
        lib = NODE_LIB[kind]
        zid = str(n.get("zone") or "")
        if zid not in zone_ids:
            zid = zones[0]["id"]
        nodes.append({
            "id": str(n.get("id") or f"n{i + 1}"),
            "name": str(n.get("name") or lib["label"]),
            "type": kind,
            "zone": zid,
            "ip": str(n.get("ip") or "—"),
            "image": str(n.get("image") or lib["image"]),
            "flavor": str(n.get("flavor") or lib["flavor"]),
            "cpu": int(n.get("cpu") or lib["cpu"]),
            "memory": int(n.get("memory") or lib["memory"]),
            "disk": int(n.get("disk") or lib["disk"]),
            "ports": int(n.get("ports") or lib["ports"]),
            "role": str(n.get("role") or lib["label"]),
            "status": "running",
        })
    if not nodes:
        return build_scenario(description, industry, business)
    ids = {n["id"] for n in nodes}

    links: list[dict] = []
    for i, l in enumerate(raw.get("links") or []):
        s, t = str(l.get("source") or ""), str(l.get("target") or "")
        if s in ids and t in ids:
            links.append({
                "id": str(l.get("id") or f"l{i + 1}"),
                "source": s,
                "target": t,
                "src_port": str(l.get("src_port") or "GE0/1"),
                "dst_port": str(l.get("dst_port") or "GE0/1"),
                "cidr": str(l.get("cidr") or ""),
                "bandwidth": str(l.get("bandwidth") or "1Gbps"),
            })

    head = re.split(r"[，。；,;]", description.strip())[0] if description.strip() else "未命名场景"
    return {
        "name": str(raw.get("name") or head[:18]),
        "description": description,
        "industry": industry,
        "business": business,
        "zones": zones,
        "nodes": nodes,
        "links": links,
        "meta": {
            "generator": "llm",
            "zone_count": len(zones),
            "node_count": len(nodes),
            "link_count": len(links),
            "host_count": sum(1 for n in nodes if n["type"] in ("pc", "server", "plc", "kali")),
        },
    }


def presets() -> list[dict]:
    return [
        {"name": n, "description": d, "topology": build_scenario(d, name=n)}
        for n, d in PRESET_DESCRIPTIONS
    ]
