import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.getenv("DATA_DIR", str(BASE_DIR / "data")))
DATA_DIR.mkdir(parents=True, exist_ok=True)

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DATA_DIR / 'craas.db'}")

# 大模型接入（OpenAI 兼容协议，默认走 DeepSeek；留空则自动降级为本地规则引擎）
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://api.deepseek.com/v1")
LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "deepseek-chat")
LLM_TIMEOUT = float(os.getenv("LLM_TIMEOUT", "45"))
# auto: 有 key 就用，没有就走规则引擎；on: 强制尝试（失败仍降级）；off: 只用规则引擎
LLM_MODE = os.getenv("LLM_MODE", "auto").lower()


def llm_ready() -> bool:
    if LLM_MODE == "off":
        return False
    if LLM_MODE == "on":
        return True
    return bool(LLM_API_KEY)


# ---------------------------------------------------------------- 对接驱动
# 每个驱动都留了 mock 实现，默认跑 mock，演示不受影响；接真实环境只改环境变量。
COMPUTE_DRIVER = os.getenv("COMPUTE_DRIVER", "mock").lower()
METRICS_DRIVER = os.getenv("METRICS_DRIVER", "mock").lower()
RESOURCE_DRIVER = os.getenv("RESOURCE_DRIVER", "mock").lower()
ALERT_DRIVER = os.getenv("ALERT_DRIVER", "mock").lower()
# 资源定时同步间隔（秒），0 表示不开启定时同步，只保留手动触发
RESOURCE_SYNC_INTERVAL = int(os.getenv("RESOURCE_SYNC_INTERVAL", "0"))

# OpenStack（计算资源创建）
OS_AUTH_URL = os.getenv("OS_AUTH_URL", "")
OS_USERNAME = os.getenv("OS_USERNAME", "")
OS_PASSWORD = os.getenv("OS_PASSWORD", "")
OS_PROJECT_NAME = os.getenv("OS_PROJECT_NAME", "admin")
OS_USER_DOMAIN = os.getenv("OS_USER_DOMAIN", "Default")
OS_PROJECT_DOMAIN = os.getenv("OS_PROJECT_DOMAIN", "Default")
OS_REGION = os.getenv("OS_REGION", "RegionOne")
OS_NETWORK_ID = os.getenv("OS_NETWORK_ID", "")
OS_AVAILABILITY_ZONE = os.getenv("OS_AVAILABILITY_ZONE", "")
OS_TIMEOUT = float(os.getenv("OS_TIMEOUT", "30"))
# 拓扑节点镜像名 → OpenStack 镜像 ID 的映射，JSON：{"ubuntu-2204-server": "uuid"}
OS_IMAGE_MAP = os.getenv("OS_IMAGE_MAP", "{}")
# 部署超时（秒），超时视为失败
COMPUTE_TIMEOUT = int(os.getenv("COMPUTE_TIMEOUT", "900"))

# Prometheus（监控指标）
PROM_URL = os.getenv("PROM_URL", "http://127.0.0.1:9090")
PROM_TIMEOUT = float(os.getenv("PROM_TIMEOUT", "10"))
# node_exporter 的网卡与带宽口径
PROM_NIC = os.getenv("PROM_NIC", "eth0")
PROM_NIC_BPS = float(os.getenv("PROM_NIC_BPS", str(1_000_000_000)))

# CMDB / 镜像仓库（资源同步）
CMDB_URL = os.getenv("CMDB_URL", "")
CMDB_TOKEN = os.getenv("CMDB_TOKEN", "")
CMDB_IMAGE_PATH = os.getenv("CMDB_IMAGE_PATH", "/api/v1/images")
CMDB_COMPUTE_PATH = os.getenv("CMDB_COMPUTE_PATH", "/api/v1/nodes")
CMDB_NETWORK_PATH = os.getenv("CMDB_NETWORK_PATH", "/api/v1/networks")
CMDB_STORAGE_PATH = os.getenv("CMDB_STORAGE_PATH", "/api/v1/storages")
CMDB_TIMEOUT = float(os.getenv("CMDB_TIMEOUT", "20"))

# 告警源（Alertmanager）
ALERT_URL = os.getenv("ALERT_URL", "http://127.0.0.1:9093")
ALERT_TIMEOUT = float(os.getenv("ALERT_TIMEOUT", "10"))

# 调度阈值（自动生成调度事件）
THRESHOLD_CPU = float(os.getenv("THRESHOLD_CPU", "85"))
THRESHOLD_MEMORY = float(os.getenv("THRESHOLD_MEMORY", "85"))
THRESHOLD_NETWORK = float(os.getenv("THRESHOLD_NETWORK", "90"))


def drivers() -> dict:
    """当前生效的对接驱动，供接口与页面展示。"""
    return {
        "compute": COMPUTE_DRIVER,
        "metrics": METRICS_DRIVER,
        "resource": RESOURCE_DRIVER,
        "alert": ALERT_DRIVER,
    }
