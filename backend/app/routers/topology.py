from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..catalog import BUSINESS, INDUSTRIES, PROFILES, STATIONS
from ..config import LLM_MODE, LLM_MODEL, llm_ready
from ..providers import driver_status
from ..services import topology as topo
from ..services.extraction import generate as extract_topology, scenes
from ..services.generation_jobs import create_job, JOBS
from ..services.model_config import load_config
from ..services.llm_client import ModelError

router = APIRouter(prefix="/api", tags=["topology"])


class GenerateReq(BaseModel):
    description: str = Field(min_length=1, max_length=20000)
    industry: str = "general"
    business: str = "pentest"
    name: str | None = None
    scene: str = "auto"


class TopologyReq(BaseModel):
    topology: dict


@router.get("/meta")
def meta() -> dict:
    try:
        model_config = load_config(require_key=False).public()
    except (ValueError, OSError):
        model_config = {}
    return {
        "business": BUSINESS,
        "industries": INDUSTRIES,
        "stations": STATIONS,
        "profiles": PROFILES,
        "llm": {
            "ready": llm_ready(),
            "mode": LLM_MODE,
            "model": model_config.get("model", "") if llm_ready() else "",
            "fallback": "AI 失败会明确报错，不自动生成替代拓扑",
            "protocol": model_config.get("protocol", ""),
            "profile": model_config.get("profile", ""),
        },
        "scenes": scenes(),
        "drivers": driver_status(),
    }


@router.get("/topology/presets")
def presets() -> dict:
    return {"items": topo.presets()}


@router.post("/topology/generate")
async def generate(req: GenerateReq) -> dict:
    if not req.description.strip():
        raise HTTPException(422, "请输入场景需求")
    if LLM_MODE == "off":
        raise HTTPException(503, "LLM_MODE=off，请启用模型后生成")
    try:
        return await extract_topology(req.description, req.industry, req.business, req.name, req.scene, load_config())
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from None
    except ModelError as exc:
        raise HTTPException(502, str(exc)) from None


@router.post("/topology/jobs", status_code=202)
async def start_generation(req: GenerateReq) -> dict:
    if not req.description.strip():
        raise HTTPException(422, "请输入场景需求")
    if req.scene != "auto" and req.scene not in {s["id"] for s in scenes()}:
        raise HTTPException(422, "不支持的场景类型")
    if LLM_MODE == "off":
        raise HTTPException(503, "LLM_MODE=off，请启用模型后生成")
    try:
        return create_job(req)
    except (ValueError, OSError):
        raise HTTPException(503, "模型配置不可用，请检查 llm.local.json、API 密钥和当前 profile") from None


@router.get("/topology/jobs/{job_id}")
def generation_job(job_id: str) -> dict:
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "任务不存在或服务已重启，请重新生成")
    return job


@router.post("/topology/validate")
def validate(req: TopologyReq) -> dict:
    return topo.validate_topology(req.topology)


@router.post("/topology/rebuild")
def rebuild(req: GenerateReq) -> dict:
    scenario = topo.build_scenario(req.description, req.industry, req.business, name=req.name)
    return {"scenario": scenario, "validation": topo.validate_topology(scenario), "generator": "rule-engine"}
