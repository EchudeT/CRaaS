"""Provider calls with streaming accumulation and a hard total timeout."""
from __future__ import annotations

import asyncio
import json
import httpx

from .model_config import ModelConfig


class ModelError(Exception):
    pass


async def call_model(config: ModelConfig, system: str, messages: list[dict], on_progress=None):
    anthropic = config.protocol == "anthropic"
    url = config.base_url + ("/messages" if anthropic else "/chat/completions")
    headers = {"x-api-key": config.api_key, "anthropic-version": "2023-06-01"} if anthropic else {"Authorization": "Bearer " + config.api_key}
    payload = {"model": config.model, "temperature": 0.2, "max_tokens": config.max_output_tokens,
               "stream": config.stream, **config.extra_body}
    if anthropic:
        payload.update(system=system, messages=messages)
    else:
        payload["messages"] = [{"role": "system", "content": system}, *messages]
    parts, finish = [], None
    usage, characters = {}, 0
    try:
        async with asyncio.timeout(config.timeout_seconds):
            async with httpx.AsyncClient(timeout=config.timeout_seconds) as client:
                if not config.stream:
                    response = await client.post(url, headers=headers, json=payload)
                    if response.status_code != 200:
                        raise ModelError(f"模型服务返回 HTTP {response.status_code}，请检查模型路由、权限或稍后重试")
                    data = response.json()
                    usage = data.get("usage", {})
                    if anthropic:
                        parts = [b.get("text", "") for b in data.get("content", []) if b.get("type") == "text"]
                        finish = data.get("stop_reason")
                    else:
                        choice = data["choices"][0]
                        parts = [choice["message"].get("content") or ""]
                        finish = choice.get("finish_reason")
                else:
                    async with client.stream("POST", url, headers=headers, json=payload) as response:
                        if response.status_code != 200:
                            raise ModelError(f"模型服务返回 HTTP {response.status_code}，请检查模型路由、权限或稍后重试")
                        async for line in response.aiter_lines():
                            if not line.startswith("data:"):
                                continue
                            raw = line[5:].strip()
                            if not raw or raw == "[DONE]":
                                continue
                            event = json.loads(raw)
                            chunk = ""
                            if anthropic:
                                kind = event.get("type")
                                if kind == "error":
                                    raise ModelError("模型生成过程中返回错误，请稍后重试")
                                if kind == "message_start":
                                    usage.update(event.get("message", {}).get("usage", {}))
                                elif kind == "content_block_delta" and event.get("delta", {}).get("type") == "text_delta":
                                    chunk = event["delta"].get("text", "")
                                elif kind == "message_delta":
                                    usage.update(event.get("usage", {}))
                                    finish = event.get("delta", {}).get("stop_reason") or finish
                            else:
                                if event.get("error"):
                                    raise ModelError("模型生成过程中返回错误，请稍后重试")
                                usage.update(event.get("usage") or {})
                                for choice in event.get("choices", []):
                                    chunk += choice.get("delta", {}).get("content") or ""
                                    finish = choice.get("finish_reason") or finish
                            if chunk:
                                parts.append(chunk)
                                characters += len(chunk)
                                if on_progress:
                                    on_progress(characters)
    except TimeoutError:
        raise ModelError(f"模型生成超过 {config.timeout_seconds} 秒，请缩短需求或调整配置后重试") from None
    except httpx.HTTPError:
        raise ModelError("无法连接模型服务，请检查网络和接口配置") from None
    except (ValueError, KeyError, TypeError):
        raise ModelError("模型服务返回了无法识别的响应") from None
    if finish in {"length", "max_tokens"}:
        raise ModelError("模型输出达到长度上限，请增大 max_output_tokens 后重试")
    content = "".join(parts).strip()
    if not content:
        raise ModelError("模型未返回有效文本，请检查模型配置")
    return content, usage
