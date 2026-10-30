from fastapi import APIRouter, HTTPException

from ..services.extraction import CATALOG, CATEGORIES, display_type
from ..services.scene_data import check_scene

router = APIRouter(prefix="/api/scenes", tags=["scenes"])


@router.get("")
def list_scenes():
    return {"items": [{"id": sid, "name": scene["scene_name"], "entity_count": len(scene["entities"]),
                       "categories": [{"id": k, "name": v} for k, v in CATEGORIES[sid].items()]}
                      for sid, scene in CATALOG["scenes"].items()]}


@router.get("/{scene}/entities")
def entities(scene: str, q: str = "", category: str = ""):
    check_scene(scene)
    if category and category not in CATEGORIES[scene]:
        raise HTTPException(422, "不支持的实体分类")
    items = CATALOG["scenes"][scene]["entities"]
    if category:
        items = [e for e in items if e["category_id"] == category]
    if q.strip():
        needle = q.strip().casefold()
        items = [e for e in items if needle in " ".join([e["entity_type_id"], e["canonical_name"], *e["aliases"]]).casefold()]
    return {"items": [{**e, "category_name": CATEGORIES[scene][e["category_id"]],
                       "display_type": display_type(e)} for e in items],
            "total": len(items), "source": "系统内置实体目录；目录类型不代表已部署设备"}
