"""业务字典：九类业务、行业、站点、部署模式（前后端共用口径）。"""

BUSINESS = [
    {"id": "drill", "name": "安全竞赛演练", "desc": "红蓝对抗竞赛、CTF 靶场，支持大规模并发与实时计分", "rule": "≥8 节点 / 双网段隔离 / 独立裁判通道"},
    {"id": "pentest", "name": "渗透测试", "desc": "贴近真实的攻防实训与授权测试环境", "rule": "攻击终端 + 靶机 / 目标网段独立"},
    {"id": "vuln", "name": "漏洞评估", "desc": "漏洞复现、影响面评估与加固验证", "rule": "靶机快照 / 漏洞库匹配"},
    {"id": "course", "name": "教学课件测评", "desc": "课程配套实验环境，随课件一键下发", "rule": "按班级批量下发 / 自动回收"},
    {"id": "skill", "name": "安全技能评测", "desc": "面向岗位技能考核的标准化评测环境", "rule": "固定拓扑 / 结果可复现"},
    {"id": "ad", "name": "攻防虚拟化", "desc": "将物理攻防环境虚拟化，支持弹性扩容", "rule": "混合云承载 / 跨站点调度"},
    {"id": "ir", "name": "事件响应取证", "desc": "应急响应与电子取证演练，保留原始现场", "rule": "流量全留存 / 证据链完整"},
    {"id": "replay", "name": "处置策略复盘", "desc": "对历史攻防过程做回放与策略验证", "rule": "流量回放 / 策略对比"},
    {"id": "research", "name": "漏洞研究复现", "desc": "0day / Nday 复现与研究型环境", "rule": "隔离沙箱 / 快照回滚"},
]

INDUSTRIES = [
    {"id": "general", "name": "通用场景"},
    {"id": "education", "name": "教育科研"},
    {"id": "government", "name": "政务"},
    {"id": "energy", "name": "能源电力"},
    {"id": "finance", "name": "金融"},
    {"id": "water", "name": "水利水务"},
    {"id": "transport", "name": "交通运输"},
    {"id": "medical", "name": "医疗卫生"},
    {"id": "manufacturing", "name": "工业制造"},
]

STATIONS = [
    {"id": "shenzhen", "name": "深圳（总部）资源池", "region": "广东省深圳市南山区", "latency": "8ms"},
    {"id": "beijing", "name": "北京（边缘）资源池", "region": "北京市海淀区", "latency": "—"},
    {"id": "wuhan", "name": "武汉（教学）资源池", "region": "湖北省武汉市洪山区", "latency": "21ms"},
]

PROFILES = [
    {"id": "training_education", "name": "教学实训", "cpu": 2, "memory": 4096},
    {"id": "competition", "name": "竞赛模式", "cpu": 4, "memory": 8192},
    {"id": "exercise", "name": "实战演练", "cpu": 4, "memory": 8192},
    {"id": "research", "name": "研究复现", "cpu": 8, "memory": 16384},
]

BUSINESS_MAP = {b["id"]: b for b in BUSINESS}


def business_name(bid: str) -> str:
    return BUSINESS_MAP.get(bid, {}).get("name", "通用业务")
