# 本地模型配置

把根目录 `llm.local.example.json` 复制为 `llm.local.json`，填写自己的配置。真实文件被 `.gitignore` 忽略，示例文件不含密钥。

修改 `active_profile` 切换当前配置；每次开始生成时重新读取，已经运行的任务继续使用提交时的配置。

```json
{
  "active_profile": "deepseek-v4-flash",
  "profiles": {
    "deepseek-v4-flash": {
      "base_url": "https://api.deepseek.com",
      "protocol": "openai",
      "model": "deepseek-v4-flash",
      "api_key": "填写你自己的密钥",
      "timeout_seconds": 600,
      "max_output_tokens": 131072,
      "concurrency": 16,
      "stream": true,
      "extra_body": { "thinking": { "type": "enabled" }, "reasoning_effort": "high" }
    }
  }
}
```

- `base_url` 是到版本前缀的地址，不包含 `/messages` 或 `/chat/completions`。
- `protocol=anthropic` 调用 `/messages`；`protocol=openai` 调用 `/chat/completions`。
- 可同时保存多个 profile。不同服务支持的协议、模型名和 `extra_body` 参数需要分别确认。
- 可将密钥留空，并设置 `api_key_env` 指向一个环境变量名。环境变量优先级高于本地文件。
- 支持 `LLM_CONFIG_FILE`、`LLM_PROFILE`、`LLM_API_KEY`、`LLM_BASE_URL`、`LLM_PROTOCOL`、`LLM_MODEL`、`LLM_TIMEOUT`、`LLM_MAX_TOKENS` 等覆盖。
- `concurrency` 为评测脚本默认并发；当前网页任务队列保守地限制为最多 3 个并发。
- `stream=true` 建议保留，长请求非流式调用可能在网关超时。页面通过后台任务查看进度。
- 页面和 `/api/meta` 只显示模型状态，不返回密钥。

当前本地使用 `deepseek-v4-flash`，此前的 `glm-flash` 配置保留。修改配置后再点一次生成即可，页面会重新获取模型状态。

DeepSeek配置使用官方模型API和OpenAI兼容协议。服务方可调整兼容模型名称的路由；模型名称沿用用户指定配置。已有三场景测试及定向补测结果见[参考工程最终核查](reference-alignment-review.md)。

后端验证：在 `backend/` 执行 `.\.venv\Scripts\python.exe -m unittest discover -s tests -v`。

前端验证：在 `frontend/` 执行 `npm run build`。

工作区评测脚本（不在运行时打包）支持：

```powershell
python research/benchmark_topology.py --show-config
python research/benchmark_topology.py --profile deepseek-v4-flash --split test --limit 0 --concurrency 16 --output research/deepseek-test-new
```

评测命令从工作区 `E:\Code\CodeSecurity` 执行。使用新的输出目录区分不同版本；同版本中断可加 `--resume` 跳过已经记录的样本。续跑会校验模型配置、运行时源码、提示词资产与数据集指纹，拒绝混用不同版本。逐条结果写入 `predictions.jsonl`，进度原子写入 `progress.json`，全量完成后写入 `summary.json`。

工作区历史测试已经完成。评测脚本不在本次应用仓库内；上述命令需要调研工作区中的research目录及参考数据集。新的全量测试应使用独立输出目录。

评测复用网页的模型客户端、提示词、结构校验及一次修复请求。仅网络、限流和服务端暂时性错误最多重试两次，校验失败不额外重抽答案；认证错误不重试。失败样本保留在全量通过率分母中，另报告失败类型和有效输出指标。测试金标只用于评分，不传入模型。模型配置文件和评测预测中的业务描述按本地资料管理，不提交密钥。

Docker 中如需使用相同文件，可将 `llm.local.json` 只读挂载并通过 `LLM_CONFIG_FILE` 指向挂载路径。当前本地开发不依赖 Docker。
