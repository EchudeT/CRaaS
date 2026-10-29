import asyncio
from dataclasses import replace
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import AsyncMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
import httpx

from app.routers.topology import router
from app.services.extraction import EXAMPLES, display_type, generate, parse_and_validate, to_scenario
from app.services.generation_jobs import JOBS
from app.services.llm_client import ModelError, call_model
from app.services.model_config import ModelConfig, load_config
from app.services.topology import validate_topology


def config():
    return ModelConfig("test", "https://model.invalid/v1", "anthropic", "test-model", "test-secret")


class ExtractionTests(unittest.TestCase):
    def test_reference_display_mappings_and_raw_names(self):
        cases = [
            ({"raw_name": "边界防火墙"}, "firewall"),
            ({"raw_name": "ToR"}, "switch"),
            ({"canonical_name": "核心路由设备"}, "router"),
            ({"raw_name": "CE"}, "router"),
            ({"name": "ECR"}, "router"),
            ({"raw_name": "工作站"}, "pc"),
            ({"raw_name": "UE"}, "pc"),
            ({"canonical_name": "client"}, "pc"),
            ({"category": "cloud_network"}, "cloud"),
            ({"raw_name": "计算资源池"}, "cloud"),
        ]
        for entity, expected in cases:
            with self.subTest(entity=entity):
                self.assertEqual(display_type(entity), expected)

    def test_reference_schema_and_semantic_rejections(self):
        mutations = {
            "missing_required": lambda v: v.pop("scene_confidence"),
            "extra_field": lambda v: v.update(unexpected=True),
            "unknown_scene": lambda v: v.update(primary_scene="unknown"),
            "duplicate_secondary": lambda v: v.update(secondary_scenes=[v["primary_scene"]] * 2),
            "invalid_id": lambda v: v["entities"][0].update(instance_id="Upper ID"),
            "unknown_entity": lambda v: v["entities"][0].update(entity_type_id="MADE_UP"),
            "duplicate_id": lambda v: v["entities"][1].update(instance_id=v["entities"][0]["instance_id"]),
            "zero_quantity": lambda v: v["entities"][0].update(quantity=0),
            "boolean_quantity": lambda v: v["entities"][0].update(quantity=True),
            "empty_evidence": lambda v: v["entities"][0].update(evidence=""),
            "bad_confidence": lambda v: v["entities"][0].update(confidence=1.1),
            "self_relation": lambda v: v["relations"][0].update(target=v["relations"][0]["source"]),
            "duplicate_relation": lambda v: v["relations"].append(dict(v["relations"][0])),
        }
        for name, mutate in mutations.items():
            with self.subTest(rule=name):
                value = json.loads(json.dumps(EXAMPLES[0]["output"]))
                mutate(value)
                self.assertTrue(parse_and_validate(json.dumps(value))[1])

    def test_reference_allows_relation_names_outside_suggested_catalog(self):
        value = json.loads(json.dumps(EXAMPLES[0]["output"]))
        value["relations"][0]["relation_type"] = "explicit_custom_relation"
        parsed, errors = parse_and_validate(json.dumps(value))
        self.assertEqual(errors, [])
        link = to_scenario(parsed, "")["links"][0]
        self.assertEqual(link["relation_type"], "explicit_custom_relation")
        value["relations"][0]["relation_type"] = "connects_to"
        self.assertTrue(to_scenario(value, "")["links"][0]["directed"])

    def test_conversion_keeps_scene_and_interface_details(self):
        value = json.loads(json.dumps(EXAMPLES[0]["output"]))
        value["entities"][0]["attributes"]["interfaces"] = "N2、N11,N12，N14/N15"
        scenario = to_scenario(value, "")
        self.assertEqual(scenario["meta"]["secondary_scenes"], value["secondary_scenes"])
        self.assertEqual(scenario["meta"]["scene_confidence"], value["scene_confidence"])
        self.assertEqual(scenario["nodes"][0]["canonical_name"], value["entities"][0]["canonical_name"])
        self.assertEqual(scenario["nodes"][0]["interfaces"], ["N2", "N11", "N12", "N14", "N15"])
        self.assertEqual(scenario["nodes"][0]["attributes"], value["entities"][0]["attributes"])

    def test_ptn_display_preserves_specific_entity_type(self):
        for entity_id in ("MAN_CORE_PTN_L3", "MAN_CORE_PTN_L2_L3", "MAN_AGGREGATION_PTN", "MAN_ACCESS_PTN"):
            self.assertEqual(display_type({"entity_type_id": entity_id, "category": "ptn_transport_network"}), "transport")
        self.assertEqual(display_type({"entity_type_id": "DC_2U_GENERAL_SERVER"}), "server")

    def test_schema_and_conversion_preserve_explicit_rate(self):
        value = json.loads(json.dumps(EXAMPLES[0]["output"]))
        value["relations"][0].update(bandwidth="100Gbps", interface="", protocol="")
        parsed, errors = parse_and_validate(json.dumps(value))
        self.assertEqual(errors, [])
        link = to_scenario(parsed, "")["links"][0]
        self.assertEqual(link["bandwidth"], "100Gbps")
        self.assertEqual(link["label"], "100Gbps")
        self.assertEqual(link["interface"], "")
        self.assertEqual(link["protocol"], "")

    def test_conversion_never_infers_or_rewrites_model_rate(self):
        value = json.loads(json.dumps(EXAMPLES[0]["output"]))
        relation = value["relations"][0]
        relation["evidence"] = "核心PTN通过100GE链路连接汇聚PTN"
        for missing in (True, False):
            relation.pop("bandwidth", None)
            if not missing:
                relation["bandwidth"] = ""
            self.assertEqual(to_scenario(value, relation["evidence"])["links"][0]["bandwidth"], "")
        relation["bandwidth"] = "2.5 Gbps"
        self.assertEqual(to_scenario(value, "")["links"][0]["bandwidth"], "2.5 Gbps")

    def test_all_training_examples_preserve_entities_relations_and_quantity(self):
        for example in EXAMPLES:
            value, errors = parse_and_validate(json.dumps(example["output"]))
            self.assertEqual(errors, [])
            scenario = to_scenario(value, example["input"])
            self.assertEqual(len(scenario["nodes"]), len(value["entities"]))
            self.assertEqual(len(scenario["links"]), len(value["relations"]))
            self.assertEqual(scenario["nodes"][0]["quantity"], value["entities"][0]["quantity"])
            self.assertEqual(scenario["nodes"][0]["image"], "")
            self.assertTrue(all(z["cidr"] == "" for z in scenario["zones"]))
            self.assertTrue(validate_topology(scenario)["passed"])

    def test_dangling_model_relation_rejected(self):
        value = json.loads(json.dumps(EXAMPLES[0]["output"]))
        value["relations"][0]["target"] = "missing"
        self.assertTrue(parse_and_validate(json.dumps(value))[1])

    def test_distinct_relation_types_not_dropped(self):
        value = json.loads(json.dumps(EXAMPLES[0]["output"]))
        relation = {**value["relations"][0], "relation_type": "connects_to"}
        value["relations"].append(relation)
        self.assertEqual(len(to_scenario(value, "")['links']), len(value["relations"]))

    def test_no_automatic_links_for_isolated_logical_nodes(self):
        scenario = to_scenario(EXAMPLES[0]["output"], "")
        scenario["links"] = []
        validation = validate_topology(scenario)
        self.assertTrue(validation["passed"])
        self.assertGreater(validation["warn_count"], 0)
        scenario["links"] = [{"source": scenario["nodes"][0]["id"], "target": "missing"}]
        self.assertFalse(validate_topology(scenario)["passed"])

    def test_profiles_and_public_config_redaction(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "model.json"
            path.write_text(json.dumps({"active_profile": "a", "profiles": {
                "a": {"base_url": "https://example.com/v1", "protocol": "anthropic", "model": "a", "api_key": "secret-a"},
                "b": {"base_url": "https://example.com/v1", "protocol": "openai", "model": "b", "api_key": "secret-b"},
            }}), encoding="utf-8")
            with patch.dict("os.environ", {}, clear=True):
                self.assertEqual(load_config(path).model, "a")
                self.assertEqual(load_config(path, "b").protocol, "openai")
                self.assertNotIn("secret-a", json.dumps(load_config(path).public()))
                self.assertNotIn("secret-a", repr(load_config(path)))


class ClientTests(unittest.IsolatedAsyncioTestCase):
    async def test_generation_keeps_separate_original_snapshot_and_repairs_once(self):
        content = json.dumps(EXAMPLES[0]["output"])
        with patch("app.services.extraction.call_model", new=AsyncMock(side_effect=[("invalid", {}), (content, {})])) as model:
            result = await generate("原始需求", "general", "drill", None, "auto", config())
        self.assertEqual(model.await_count, 2)
        self.assertTrue(result["repair_attempted"])
        self.assertEqual(result["raw_analysis"], content)
        self.assertEqual(result["extraction"], EXAMPLES[0]["output"])
        result["scenario"]["nodes"][0]["attributes"]["edited"] = True
        self.assertNotIn("edited", result["extraction"]["entities"][0]["attributes"])
        repaired_messages = model.call_args_list[1].args[2]
        self.assertEqual(repaired_messages[0]["content"], "原始需求")
        self.assertEqual(repaired_messages[1]["content"], "invalid")
        with patch("app.services.extraction.call_model", new=AsyncMock(return_value=("invalid", {}))) as model:
            with self.assertRaises(ModelError):
                await generate("原始需求", "general", "drill", None, "auto", config())
        self.assertEqual(model.await_count, 2)

    async def test_stream_collects_only_text_and_uses_messages_protocol(self):
        events = [
            {"type": "message_start", "message": {"usage": {"input_tokens": 3}}},
            {"type": "content_block_delta", "delta": {"type": "thinking_delta", "thinking": "private"}},
            {"type": "content_block_delta", "delta": {"type": "text_delta", "text": '{"ok":'}},
            {"type": "content_block_delta", "delta": {"type": "text_delta", "text": 'true}'}},
            {"type": "message_delta", "delta": {"stop_reason": "end_turn"}},
        ]
        def handler(request):
            self.assertEqual(request.url.path, "/v1/messages")
            self.assertEqual(request.headers["x-api-key"], "test-secret")
            return httpx.Response(200, text="".join("data: " + json.dumps(e) + "\n\n" for e in events))
        real_client = httpx.AsyncClient
        with patch("app.services.llm_client.httpx.AsyncClient", side_effect=lambda **kwargs: real_client(transport=httpx.MockTransport(handler), **kwargs)):
            content, _ = await call_model(config(), "system", [{"role": "user", "content": "test"}])
        self.assertEqual(json.loads(content), {"ok": True})

    async def test_http_failure_does_not_return_rule_topology_or_provider_body(self):
        real_client = httpx.AsyncClient
        with patch("app.services.llm_client.httpx.AsyncClient", side_effect=lambda **kwargs: real_client(transport=httpx.MockTransport(lambda req: httpx.Response(503, text="sensitive-provider-body")), **kwargs)):
            with self.assertRaises(ModelError) as caught:
                await call_model(config(), "system", [])
        self.assertIn("503", str(caught.exception))
        self.assertNotIn("sensitive", str(caught.exception))


class JobTests(unittest.TestCase):
    def setUp(self):
        JOBS.clear()
        self.app = FastAPI()
        self.app.include_router(router)

    def test_job_failure_is_visible_without_fallback(self):
        with patch("app.services.generation_jobs.load_config", return_value=config()), patch("app.services.generation_jobs.generate", new=AsyncMock(side_effect=ModelError("模型服务返回 HTTP 503"))):
            with TestClient(self.app) as client:
                response = client.post("/api/topology/jobs", json={"description": "部署AMF和SMF"})
                self.assertEqual(response.status_code, 202)
                job_id = response.json()["id"]
                job = client.get("/api/topology/jobs/" + job_id).json()
                self.assertEqual(job["status"], "failed")
                self.assertIsNone(job["result"])
                self.assertIn("503", job["error"])

    def test_own_generate_endpoint_calls_configured_model_directly(self):
        output = EXAMPLES[0]["output"]
        requests = []
        def handler(request):
            requests.append(request)
            self.assertEqual(str(request.url), "https://model.invalid/v1/chat/completions")
            body = json.loads(request.content)
            self.assertEqual(body["messages"][0]["role"], "system")
            self.assertEqual(body["messages"][1]["content"], "部署AMF和SMF")
            return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(output)}, "finish_reason": "stop"}]})
        real_client = httpx.AsyncClient
        model_config = replace(config(), protocol="openai", stream=False)
        with patch("app.routers.topology.load_config", return_value=model_config), patch(
            "app.services.llm_client.httpx.AsyncClient",
            side_effect=lambda **kwargs: real_client(transport=httpx.MockTransport(handler), **kwargs),
        ):
            with TestClient(self.app) as client:
                response = client.post("/api/topology/generate", json={"description": "部署AMF和SMF"})
        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertEqual(result["extraction"], output)
        self.assertEqual(len(result["scenario"]["nodes"]), len(output["entities"]))
        self.assertEqual(len(requests), 1)

    def test_blank_or_unknown_scene_rejected_before_calling_model(self):
        with TestClient(self.app) as client:
            self.assertEqual(client.post("/api/topology/jobs", json={"description": "  "}).status_code, 422)
            self.assertEqual(client.post("/api/topology/jobs", json={"description": "部署AMF", "scene": "unknown"}).status_code, 422)


if __name__ == "__main__":
    unittest.main()
