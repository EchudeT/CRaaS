"""Runtime model profiles. Never return credentials to the browser."""
from __future__ import annotations

from dataclasses import dataclass, field
import json
import os
from pathlib import Path
from urllib.parse import urlsplit

DEFAULT_CONFIG = Path(__file__).resolve().parents[3] / "llm.local.json"


@dataclass(frozen=True)
class ModelConfig:
    profile: str
    base_url: str
    protocol: str
    model: str
    api_key: str = field(repr=False)
    timeout_seconds: int = 240
    max_output_tokens: int = 18000
    concurrency: int = 3
    stream: bool = True
    extra_body: dict = field(default_factory=dict)

    def public(self):
        return {
            "profile": self.profile, "base_url": self.base_url,
            "protocol": self.protocol, "model": self.model,
            "api_key_configured": bool(self.api_key),
            "timeout_seconds": self.timeout_seconds,
            "max_output_tokens": self.max_output_tokens,
            "concurrency": self.concurrency, "stream": self.stream,
        }


def load_config(path=None, profile=None, *, require_key=True):
    path = Path(path or os.getenv("LLM_CONFIG_FILE", str(DEFAULT_CONFIG)))
    selected, values = "environment", {}
    if path.exists():
        content = json.loads(path.read_text(encoding="utf-8-sig"))
        selected = profile or os.getenv("LLM_PROFILE") or content.get("active_profile")
        values = content.get("profiles", {}).get(selected)
        if not isinstance(values, dict):
            raise ValueError("模型配置中未找到指定 profile")
    elif profile:
        raise ValueError("本地模型配置文件不存在")

    def setting(env, name, default=""):
        return os.getenv("TOPOLOGY_BENCH_" + env, os.getenv("LLM_" + env, values.get(name, default)))

    config = ModelConfig(
        profile=selected,
        base_url=setting("BASE_URL", "base_url", "https://api.deepseek.com/v1").rstrip("/"),
        protocol=setting("PROTOCOL", "protocol", "openai"),
        model=setting("MODEL", "model", "deepseek-chat"),
        api_key=os.getenv("TOPOLOGY_BENCH_API_KEY") or os.getenv("LLM_API_KEY")
            or os.getenv(values.get("api_key_env", "")) or values.get("api_key", ""),
        timeout_seconds=int(setting("TIMEOUT", "timeout_seconds", 240)),
        max_output_tokens=int(setting("MAX_TOKENS", "max_output_tokens", 18000)),
        concurrency=int(setting("CONCURRENCY", "concurrency", 3)),
        stream=values.get("stream", True), extra_body=values.get("extra_body", {}),
    )
    url = urlsplit(config.base_url)
    if url.scheme not in {"http", "https"} or not url.netloc or url.username or url.password or url.query or url.fragment:
        raise ValueError("模型 base_url 必须是无凭证、无查询参数的 HTTP(S) 地址")
    if config.protocol not in {"openai", "anthropic"}:
        raise ValueError("protocol 必须是 openai 或 anthropic")
    if not config.model or (require_key and not config.api_key):
        raise ValueError("请在 llm.local.json 配置模型名称和 API 密钥")
    if min(config.timeout_seconds, config.max_output_tokens, config.concurrency) <= 0:
        raise ValueError("超时、输出长度和并发数必须大于零")
    if not isinstance(config.stream, bool) or not isinstance(config.extra_body, dict):
        raise ValueError("stream 必须是布尔值，extra_body 必须是对象")
    if set(config.extra_body) & {"model", "messages", "system", "stream", "max_tokens"}:
        raise ValueError("extra_body 不得覆盖核心调用参数")
    return config
