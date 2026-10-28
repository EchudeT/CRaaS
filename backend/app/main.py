import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import models  # noqa: F401  确保建表
from .config import LLM_MODE, RESOURCE_SYNC_INTERVAL, llm_ready
from .db import Base, SessionLocal, engine
from .providers import driver_status
from .routers import instances, monitor, resources, scheduler, templates, topology
from .seed import seed

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
log = logging.getLogger("craas")


async def _periodic_resource_sync() -> None:
    """按 RESOURCE_SYNC_INTERVAL 定时从 CMDB / 镜像仓库同步资源。"""
    while True:
        await asyncio.sleep(RESOURCE_SYNC_INTERVAL)
        db = SessionLocal()
        try:
            resources.sync_resources(db)
            log.info("已按计划同步资源（间隔 %ss）", RESOURCE_SYNC_INTERVAL)
        except Exception as exc:  # noqa: BLE001
            log.warning("定时资源同步失败：%s", exc)
        finally:
            db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
    seed()
    log.info(
        "靶场平台即服务系统 API 已启动｜大模型：%s（mode=%s）｜驱动：%s",
        "已接入" if llm_ready() else "未配置，走本地规则引擎",
        LLM_MODE,
        driver_status(),
    )
    task = None
    if RESOURCE_SYNC_INTERVAL > 0:
        task = asyncio.create_task(_periodic_resource_sync())
    yield
    if task:
        task.cancel()


app = FastAPI(title="靶场平台即服务系统 · CRaaS API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (topology.router, templates.router, instances.router, resources.router, monitor.router, scheduler.router):
    app.include_router(r)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "llm": llm_ready(), "drivers": driver_status()}
