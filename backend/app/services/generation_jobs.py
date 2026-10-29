"""Bounded in-process generation jobs for the local demo."""
import asyncio
import logging
import time
import uuid

from .extraction import generate
from .llm_client import ModelError
from .model_config import load_config

log = logging.getLogger("craas.generation")
JOBS = {}
TASKS = set()
LIMIT = asyncio.Semaphore(3)


def create_job(request):
    config = load_config()
    now = time.time()
    for key in list(JOBS):
        job = JOBS[key]
        if job["status"] in {"succeeded", "failed"} and now - job["updated_at"] > 3600:
            del JOBS[key]
    if len(JOBS) >= 100:
        oldest = next((k for k, v in JOBS.items() if v["status"] in {"succeeded", "failed"}), None)
        if oldest:
            del JOBS[oldest]
        else:
            raise ValueError("生成任务过多，请稍后重试")
    job = {"id": uuid.uuid4().hex, "status": "queued", "stage": "queued", "characters": 0,
           "created_at": now, "updated_at": now, "model": config.model, "result": None, "error": ""}
    JOBS[job["id"]] = job

    async def run():
        async with LIMIT:
            job.update(status="running", updated_at=time.time())
            def progress(stage, characters):
                job.update(stage=stage, characters=characters, updated_at=time.time())
            try:
                result = await generate(request.description, request.industry, request.business, request.name,
                                        request.scene, config, progress)
                job.update(status="succeeded", stage="done", result=result, updated_at=time.time())
            except (ModelError, ValueError) as exc:
                job.update(status="failed", stage="failed", error=str(exc), updated_at=time.time())
            except Exception:
                log.error("Generation job failed: %s", job["id"])
                job.update(status="failed", stage="failed", error="生成任务失败，请重试或检查服务日志", updated_at=time.time())
    task = asyncio.create_task(run())
    TASKS.add(task)
    task.add_done_callback(TASKS.discard)
    return job
