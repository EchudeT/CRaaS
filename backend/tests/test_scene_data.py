"""离线示例、场景筛选、来源标记与真实资源替换边界。"""
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base, get_db
from app.models import ComputeNode, Instance, ResourceContext, Template
from app.routers import instances, monitor, resources, scenes, templates
from app.scene_seed import seed_scenes
from app.services.extraction import CATALOG, EXAMPLES, display_type
from app.services.topology import validate_topology


class SceneDataTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.sessions = sessionmaker(bind=self.engine, expire_on_commit=False, autoflush=False)
        self.db = self.sessions()
        with patch("app.services.extraction.call_model", side_effect=AssertionError("离线数据不得调用模型")):
            seed_scenes(self.db)
        app = FastAPI()
        for router in (scenes.router, templates.router, resources.router, instances.router, monitor.router):
            app.include_router(router)
        app.dependency_overrides[get_db] = lambda: self.db
        self.client = TestClient(app)

    def tearDown(self):
        self.client.close()
        self.db.close()
        self.engine.dispose()

    def get(self, path, **params):
        response = self.client.get(path, params=params)
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_all_six_templates_preserve_grounded_data_and_validate(self):
        result = self.get("/api/templates")
        self.assertEqual(result["total"], 6)
        for example in EXAMPLES:
            row = self.get(f"/api/templates/tpl_demo_{example['sample_id']}")
            topology = row["topology"]
            self.assertTrue(row["is_demo"])
            self.assertEqual(row["source"], "example")
            self.assertEqual(row["scene"], example["scene_id"])
            self.assertEqual(topology["description"], example["input"])
            self.assertFalse(topology["meta"]["deployment_ready"])
            self.assertTrue(validate_topology(topology)["passed"])
            for actual, expected in zip(topology["nodes"], example["output"]["entities"]):
                self.assertEqual(actual["quantity"], expected["quantity"])
                self.assertEqual(actual["attributes"], expected["attributes"])
                self.assertEqual(actual["evidence"], expected["evidence"])
                self.assertIn(actual["evidence"], example["input"])
            for link, expected in zip(topology["links"], example["output"]["relations"]):
                self.assertEqual(link["interface"], expected["interface"])
                self.assertEqual(link["evidence"], expected["evidence"])
                self.assertIn(link["evidence"], example["input"])

    def test_manual_catalog_node_saves_position_and_provenance_without_changing_facts(self):
        path = "/api/templates/tpl_demo_CNS-TR-001"
        topology = self.get(path)["topology"]
        original_nodes = list(topology["nodes"])
        original_links = list(topology["links"])
        first = original_nodes[0]
        topology["nodes"].append({"id": "manual_catalog_node", "name": "手工添加设备", "type": first["type"],
            "zone": first["zone"], "entity_type_id": first["entity_type_id"], "quantity": 1,
            "attributes": {}, "evidence": "", "origin": "manual", "status": "planned", "x": -50, "y": 280,
            "ip": "", "image": "", "flavor": "", "cpu": 0, "memory": 0, "disk": 0, "ports": 0})
        self.assertTrue(validate_topology(topology)["passed"])
        with patch("app.services.extraction.call_model", side_effect=AssertionError("手工编辑不得调用模型")):
            saved = self.client.put(path, json={"topology": topology})
            self.assertEqual(saved.status_code, 200)
            reopened = self.get(path)["topology"]
        self.assertEqual(reopened["nodes"][:-1], original_nodes)
        self.assertEqual(reopened["links"], original_links)
        self.assertEqual(reopened["nodes"][-1]["origin"], "manual")
        self.assertEqual(reopened["nodes"][-1]["x"], -50)
        self.assertEqual(reopened["nodes"][-1]["evidence"], "")

    def test_catalog_browse_search_and_category_use_original_data(self):
        catalogs = self.get("/api/scenes")["items"]
        self.assertEqual(len(catalogs), 3)
        total = 0
        for scene in catalogs:
            sid = scene["id"]
            items = self.get(f"/api/scenes/{sid}/entities")["items"]
            self.assertEqual(len(items), scene["entity_count"])
            self.assertEqual({e["entity_type_id"] for e in items}, {e["entity_type_id"] for e in CATALOG["scenes"][sid]["entities"]})
            for entity in items:
                self.assertEqual(entity["display_type"], display_type(entity))
            first = items[0]
            self.assertEqual(self.get(f"/api/scenes/{sid}/entities", q=first["entity_type_id"])["items"][0]["entity_type_id"], first["entity_type_id"])
            filtered = self.get(f"/api/scenes/{sid}/entities", category=first["category_id"])["items"]
            self.assertTrue(all(e["category_id"] == first["category_id"] for e in filtered))
            self.assertEqual(self.get(f"/api/scenes/{sid}/entities", q="no-such-entity")["total"], 0)
            total += len(items)
        self.assertEqual(total, 156)

    def test_scene_filters_keep_templates_resources_instances_and_monitor_aligned(self):
        for sid in CATALOG["scenes"]:
            self.assertEqual(self.get("/api/templates", scene=sid)["total"], 2)
            for kind in ("images", "compute", "storage", "network"):
                rows = self.get(f"/api/resources/{kind}", scene=sid)["items"]
                self.assertEqual(len(rows), 1)
                self.assertEqual(rows[0]["scene_ids"], [sid])
                self.assertTrue(rows[0]["is_demo"])
            overview = self.get("/api/resources/overview", scene=sid)
            self.assertEqual(overview["demo_count"], 4)
            self.assertEqual(overview["cards"][0]["count"], 1)
            instance = self.get("/api/instances", scene=sid)["items"]
            self.assertEqual(len(instance), 1)
            self.assertEqual(instance[0]["status"], "demo")
            self.assertTrue(instance[0]["is_demo"])
            self.assertTrue(all(n["status"] == "demo" and not n["ip"] and not n["password"] for n in instance[0]["nodes"]))
            self.assertEqual(len(instance[0]["nodes"]), self.get(f"/api/templates/{instance[0]['template_id']}")["topology"]["meta"]["host_count"])
            metrics = self.get("/api/monitor/overview", scene=sid)
            self.assertEqual(metrics["summary"]["node_count"], 1)
            self.assertEqual(metrics["instances"][0]["id"], instance[0]["id"])
            self.assertEqual(metrics["nodes"][0]["metrics"]["source"], "demo")

    def test_seed_is_idempotent_preserves_edits_and_existing_user_data(self):
        template = self.db.get(Template, "tpl_demo_CNS-TR-001")
        template.name = "我的修改"
        self.db.add(Template(id="user-template", name="用户模板", topology={"nodes": []}))
        context = self.db.get(ResourceContext, ("compute", "cmp_demo_scene_1"))
        context.scene_ids = []
        self.db.commit()
        seed_scenes(self.db)
        seed_scenes(self.db)
        self.assertEqual(len(self.db.scalars(select(Template)).all()), 7)
        self.assertEqual(len(self.db.scalars(select(Instance)).all()), 3)
        self.assertEqual(template.name, "我的修改")
        self.assertEqual(context.scene_ids, [])
        with patch("app.seed.SessionLocal", self.sessions):
            from app.seed import seed
            seed()  # 已有数据库也能补充场景数据，不删除用户记录
        self.assertIsNotNone(self.db.get(Template, "user-template"))

    def test_fresh_startup_seeds_legacy_and_scenes_only_once(self):
        Base.metadata.drop_all(self.engine)
        Base.metadata.create_all(self.engine)
        self.db.close()
        self.db = self.sessions()
        with patch("app.seed.SessionLocal", self.sessions):
            from app.seed import seed
            seed()
            seed()
        self.assertEqual(len(self.db.scalars(select(Template)).all()), 18)
        self.assertEqual(len(self.db.scalars(select(Instance)).all()), 7)
        self.assertTrue(all(c.data_origin == "demo" for c in self.db.scalars(select(ResourceContext))))

    def test_demo_metrics_never_query_real_provider_and_destroy_never_calls_platform(self):
        with patch("app.routers.monitor.metrics_provider", side_effect=AssertionError("演示节点不能查真实监控")):
            row = self.get("/api/monitor/overview")["nodes"][0]
            history = self.get(f"/api/monitor/nodes/{row['id']}/history")
            self.assertEqual(history["source"], "demo")
            self.assertEqual(len(history["points"]), 24)
        with patch("app.routers.instances.destroy_instance", side_effect=AssertionError("不得销毁真实资源")):
            self.assertEqual(self.client.post("/api/instances/ins_demo_scene_1/destroy").status_code, 422)
        self.assertEqual(self.client.post("/api/instances/preview", json={"template_id": "tpl_demo_CNS-TR-001"}).status_code, 422)

    def test_registered_resource_can_replace_scene_demo_without_changing_provenance(self):
        sid = next(iter(CATALOG["scenes"]))
        self.db.add(ComputeNode(id="real-node", name="已录入节点"))
        self.db.commit()
        target = "/api/resources/compute/real-node/context"
        self.assertEqual(self.client.put(target, json={"scene_ids": [sid, sid]}).status_code, 200)
        self.client.put("/api/resources/compute/cmp_demo_scene_1/context", json={"scene_ids": []})
        rows = self.get("/api/resources/compute", scene=sid)["items"]
        self.assertEqual([r["id"] for r in rows], ["real-node"])
        self.assertFalse(rows[0]["is_demo"])
        self.assertEqual(rows[0]["data_origin"], "registered")
        seed_scenes(self.db)
        self.assertEqual(self.get("/api/resources/compute", scene=sid)["items"][0]["id"], "real-node")

    def test_new_resources_created_in_scene_are_visible_immediately(self):
        sid = next(iter(CATALOG["scenes"]))
        for kind in ("images", "compute"):
            result = self.client.post(f"/api/resources/{kind}", json={"name": f"new-{kind}", "scene_ids": [sid]})
            self.assertEqual(result.status_code, 200, result.text)
            item = result.json()
            self.assertEqual(item["scene_ids"], [sid])
            self.assertEqual(item["data_origin"], "registered")
            self.assertFalse(item["is_demo"])
            self.assertIn(item["id"], [r["id"] for r in self.get(f"/api/resources/{kind}", scene=sid)["items"]])
            rejected = self.client.post(f"/api/resources/{kind}", json={"name": "invalid", "scene_ids": ["unknown"]})
            self.assertEqual(rejected.status_code, 422)

    def test_executor_persists_scene_snapshot_and_keeps_mock_lifecycle(self):
        from app.services.executor import create_instance
        sid = next(iter(CATALOG["scenes"]))
        template = Template(id="mapped-template", name="已映射模板", topology={"meta": {"scene": sid}, "nodes": []})
        self.db.add(template)
        self.db.commit()
        with patch("app.services.executor.compute_provider", return_value=SimpleNamespace(name="mock")):
            instance = create_instance(self.db, template, profile={"custom": "preserved"})
        template.topology = {"meta": {"scene": ""}, "nodes": []}
        self.db.commit()
        result = self.get(f"/api/instances/{instance.id}")
        self.assertEqual(result["scene"], sid)
        self.assertTrue(result["is_demo"])
        self.assertEqual(result["profile"]["custom"], "preserved")
        with patch("app.routers.instances.destroy_instance") as destroy:
            self.assertEqual(self.client.post(f"/api/instances/{instance.id}/destroy").status_code, 200)
            destroy.assert_called_once()

    def test_real_metrics_and_failure_fallback_report_origin(self):
        self.db.add(ComputeNode(id="real-node", name="已录入节点"))
        self.db.commit()
        from app.providers.mock import MockMetricsProvider
        provider = MockMetricsProvider()
        provider.name = "prometheus"
        with patch("app.routers.monitor.metrics_provider", return_value=provider):
            history = self.get("/api/monitor/nodes/real-node/history")
            self.assertEqual(history["source"], "real")
        with patch("app.routers.monitor.metrics_provider") as get_provider:
            get_provider.return_value.name = "prometheus"
            get_provider.return_value.node.side_effect = RuntimeError("unavailable")
            get_provider.return_value.history.side_effect = RuntimeError("unavailable")
            self.assertEqual(self.get("/api/monitor/nodes/real-node/history")["source"], "fallback")
            node = next(n for n in self.get("/api/monitor/overview")["nodes"] if n["id"] == "real-node")
            self.assertEqual(node["metrics"]["source"], "fallback")

    def test_sync_preserves_association_and_does_not_overwrite_demo(self):
        demo = self.db.get(ComputeNode, "cmp_demo_scene_1")
        resources._upsert(self.db, ComputeNode, [{"name": demo.name, "cpu_cores": 128}], "cmp")
        self.db.commit()
        self.assertEqual(demo.cpu_cores, 64)
        rows = self.db.scalars(select(ComputeNode).where(ComputeNode.name == demo.name)).all()
        self.assertEqual(len(rows), 2)
        real = next(r for r in rows if r.id != demo.id)
        sid = next(iter(CATALOG["scenes"]))
        self.client.put(f"/api/resources/compute/{real.id}/context", json={"scene_ids": [sid]})
        resources._upsert(self.db, ComputeNode, [{"name": demo.name, "cpu_cores": 256}], "cmp")
        self.db.commit()
        self.assertEqual(real.cpu_cores, 256)
        context = self.db.get(ResourceContext, ("compute", real.id))
        self.assertEqual(context.data_origin, "synced")
        self.assertEqual(context.scene_ids, [sid])

    def test_invalid_filter_and_missing_history_return_errors(self):
        for path in ("/api/templates", "/api/instances", "/api/resources/overview", "/api/resources/compute", "/api/monitor/overview"):
            self.assertEqual(self.client.get(path, params={"scene": "unknown"}).status_code, 422)
        self.assertEqual(self.client.get("/api/scenes/unknown/entities").status_code, 422)
        self.assertEqual(self.client.get("/api/monitor/nodes/missing/history").status_code, 404)
        self.assertEqual(self.client.get("/api/monitor/nodes/cmp_demo_scene_1/history", params={"points": 9999}).status_code, 422)
        self.assertEqual(self.client.put("/api/resources/compute/cmp_demo_scene_1/context", json={"scene_ids": [""]}).status_code, 422)


if __name__ == "__main__":
    unittest.main()
