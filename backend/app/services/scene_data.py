"""场景展示与资源关联。这里不参与模型抽取或补全网络事实。"""
from fastapi import HTTPException
from sqlalchemy import select

from ..models import ResourceContext
from .extraction import CATALOG


def check_scene(scene):
    if scene and scene not in CATALOG["scenes"]:
        raise HTTPException(422, "不支持的网络场景")


def validate_scene_ids(scene_ids):
    for scene in scene_ids:
        if not scene:
            raise HTTPException(422, "场景不能为空")
        check_scene(scene)
    return list(dict.fromkeys(scene_ids))


def scene_meta(scene):
    return {"scene": scene, "scene_name": CATALOG["scenes"].get(scene, {}).get("scene_name", "未分类")}


def template_context(template):
    meta = (template.topology or {}).get("meta", {})
    return {**scene_meta(meta.get("scene", "")), "is_demo": bool(meta.get("is_demo")),
            "sample_id": meta.get("sample_id", "")}


def instance_context(instance):
    profile = instance.profile or {}
    return {**scene_meta(profile.get("scene", "")), "is_demo": bool(profile.get("is_demo"))}


def resource_contexts(db, kind):
    return {c.resource_id: c for c in db.scalars(select(ResourceContext).where(ResourceContext.kind == kind))}


def resource_context(context):
    scenes = context.scene_ids if context else []
    origin = context.data_origin if context else "registered"
    return {"scene_ids": scenes, "scene_names": [scene_meta(s)["scene_name"] for s in scenes],
            "data_origin": origin, "is_demo": origin == "demo"}


def contextualize(db, kind, items, serializer, scene=""):
    check_scene(scene)
    contexts = resource_contexts(db, kind)
    result = []
    for item in items:
        context = resource_context(contexts.get(item.id))
        if not scene or scene in context["scene_ids"]:
            result.append({**serializer(item), **context})
    return result
