"""大模型接入：OpenAI 兼容协议，输出严格 JSON，失败自动降级。"""

from __future__ import annotations

import json
import logging
import re

import httpx

from ..config import LLM_API_KEY, LLM_BASE_URL, LLM_MODEL, LLM_TIMEOUT

log = logging.getLogger("craas.llm")

SYSTEM_PROMPT = """你是网络安全靶场（Cyber Range）的组网专家。用户会用中文描述一个要构建的靶场网络场景，
你需要把它转换成结构化的拓扑 JSON，用于自动生成 IaC 代码并渲染拓扑图。

只输出 JSON，不要输出任何解释、不要用 markdown 代码块包裹。JSON 结构如下：
{
  "name": "场景名称，不超过 20 字",
  "zones": [
    {"id": "zone_office", "name": "办公区", "cidr": "10.0.1.0/24"}
  ],
  "nodes": [
    {"id": "n1", "name": "核心路由器", "type": "router", "zone": "zone_edge",
     "ip": "10.0.0.1", "cpu": 4, "memory": 8192, "disk": 8, "ports": 8}
  ],
  "links": [
    {"source": "n1", "target": "n2", "src_port": "GE0/1", "dst_port": "GE0/1", "cidr": "10.0.0.0/30"}
  ]
}

约束：
1. type 只能是 router / switch / firewall / server / pc / kali / plc / ids / cloud。
2. 每个区域必须有一台 switch 或 router 做网关，网关 IP 用该网段的 .1 或 .2；主机 IP 从 .10 开始，不能重复。
3. 必须包含一台 type=cloud 的"互联网"节点，并有一台 router 或 firewall 与它相连。
4. 节点之间必须联网，不能有孤岛；links 的 source/target 必须是已存在的 node id。
5. 网段划分清晰，不同区域用不同 /24 网段；节点数量控制在 8~16 个。
6. 名称使用中文，符合行业习惯。"""


def _extract_json(text: str) -> dict | None:
    text = text.strip()
    text = re.sub(r"^```(?:json)?|```$", "", text, flags=re.MULTILINE).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start >= 0 and end > start:
            try:
                return json.loads(text[start: end + 1])
            except json.JSONDecodeError:
                return None
    return None


async def generate_topology(description: str, industry: str = "general", business: str = "pentest") -> dict | None:
    if not LLM_API_KEY:
        return None

    payload = {
        "model": LLM_MODEL,
        "temperature": 0.2,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"行业：{industry}\n业务类型：{business}\n场景描述：{description}",
            },
        ],
    }
    headers = {"Authorization": f"Bearer {LLM_API_KEY}", "Content-Type": "application/json"}
    url = LLM_BASE_URL.rstrip("/") + "/chat/completions"

    for attempt in (1, 2):
        try:
            async with httpx.AsyncClient(timeout=LLM_TIMEOUT) as client:
                resp = await client.post(url, json=payload, headers=headers)
                resp.raise_for_status()
                data = resp.json()
                content = data["choices"][0]["message"]["content"]
                parsed = _extract_json(content)
                if parsed and parsed.get("nodes"):
                    return parsed
                log.warning("LLM 输出无法解析（第 %s 次），内容片段：%s", attempt, content[:200])
        except Exception as exc:  # noqa: BLE001
            log.warning("LLM 调用失败（第 %s 次）：%s", attempt, exc)
            if attempt == 2:
                break
    return None
