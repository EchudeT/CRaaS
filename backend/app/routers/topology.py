from fastapi import APIRouter
from pydantic import BaseModel

from ..catalog import BUSINESS, INDUSTRIES, PROFILES, STATIONS
from ..config import LLM_MODE, LLM_MODEL, llm_ready
from ..providers import driver_status
from ..services import topology as topo
from ..services.llm import generate_topology

router = APIRouter(prefix="/api", tags=["topology"])


class GenerateReq(BaseModel):
    description: str
    industry: str = "general"
    business: str = "pentest"
    name: str | None = None


class TopologyReq(BaseModel):
    topology: dict


@router.get("/meta")
def meta() -> dict:
    return {
        "business": BUSINESS,
        "industries": INDUSTRIES,
        "stations": STATIONS,
        "profiles": PROFILES,
        "llm": {
            "ready": llm_ready(),
            "mode": LLM_MODE,
            "model": LLM_MODEL if llm_ready() else "",
            "fallback": "本地规则引擎（抽取区域 / 数量 / 网段）",
        },
        "drivers": driver_status(),
    }


@router.get("/topology/presets")
def presets() -> dict:
    return {"items": topo.presets()}


@router.post("/topology/generate")
async def generate(req: GenerateReq) -> dict:
    scenario = None
    generator = "rule-engine"
    if llm_ready():
        raw = await generate_topology(req.description, req.industry, req.business)
        if raw:
            scenario = topo.normalize(raw, req.description, req.industry, req.business)
            scenario["name"] = req.name or scenario["name"]
            generator = "llm"
    if scenario is None:
        scenario = topo.build_scenario(
            req.description, req.industry, req.business, name=req.name
        )
    return {
        "scenario": scenario,
        "validation": topo.validate_topology(scenario),
        "generator": generator,
    }


@router.post("/topology/validate")
def validate(req: TopologyReq) -> dict:
    return topo.validate_topology(req.topology)


@router.post("/topology/rebuild")
def rebuild(req: GenerateReq) -> dict:
    scenario = topo.build_scenario(req.description, req.industry, req.business, name=req.name)
    return {"scenario": scenario, "validation": topo.validate_topology(scenario), "generator": "rule-engine"}
