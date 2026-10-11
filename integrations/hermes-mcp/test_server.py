"""Run with the adapter's Python after `npm run build:server`.

The round-trip test starts a disposable real BudgetFlow backend and an actual
stdio MCP subprocess. It never connects to your running app or personal data.
"""
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch
from urllib.error import URLError
from urllib.request import urlopen

from mcp import Client
from mcp.server.mcpserver.exceptions import ToolError
from mcp.client.stdio import StdioServerParameters
from server import BudgetClient

ROOT = Path(__file__).resolve().parents[2]


class ClientTests(unittest.TestCase):
    def test_rejects_missing_secrets_and_credential_urls(self):
        for url, token in [("", "x" * 64), ("http://host", ""), ("http://host", "${TOKEN}"),
                           ("https://user:password@host", "x" * 64), ("file:///tmp/data", "x" * 64)]:
            with self.assertRaises(ValueError):
                BudgetClient(url, token)

    def test_uncertain_write_is_not_retried(self):
        client = BudgetClient("http://127.0.0.1", "x" * 64)
        with patch.object(client.http, "open", side_effect=URLError("offline")) as request:
            with self.assertRaisesRegex(ToolError, "outcome is uncertain"):
                client.request("/api/assistant/actions", {"operation": "create_category"})
            self.assertEqual(request.call_count, 1)


class RoundTripTests(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls):
        (ROOT / ".toolchain").mkdir(exist_ok=True)
        cls.directory = tempfile.TemporaryDirectory(prefix="mcp-test-", dir=ROOT / ".toolchain")
        cls.token = secrets.token_hex(32)
        with socket.socket() as port:
            port.bind(("127.0.0.1", 0))
            cls.url = f"http://127.0.0.1:{port.getsockname()[1]}"
            cls.port = str(port.getsockname()[1])
        cls.env = {**os.environ, "HOST": "127.0.0.1", "PORT": cls.port, "DATA_DIR": cls.directory.name,
                   "AUTH_ENABLED": "false", "ASSISTANT_API_TOKEN": cls.token, "LOG_LEVEL": "silent", "NODE_ENV": "production"}
        cls.start_backend()

    @classmethod
    def start_backend(cls):
        cls.process = subprocess.Popen(["node", str(ROOT / "server/dist/index.js")], cwd=ROOT, env=cls.env,
                                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(100):
            if cls.process.poll() is not None:
                raise RuntimeError("Test backend exited; run npm run build:server first")
            try:
                with urlopen(cls.url + "/api/health", timeout=0.5):
                    return
            except (OSError, URLError):
                time.sleep(0.1)
        cls.process.terminate()
        raise RuntimeError("Test backend did not become ready")

    @classmethod
    def tearDownClass(cls):
        cls.process.terminate()
        cls.process.wait(timeout=10)
        cls.directory.cleanup()

    async def test_stdio_discovery_operations_conflicts_and_restart(self):
        params = StdioServerParameters(command=sys.executable, args=[str(Path(__file__).with_name("server.py"))],
                                       env={"BUDGETFLOW_URL": self.url, "BUDGETFLOW_API_TOKEN": self.token})
        async with Client(params) as client:
            listing = await client.list_tools()
            self.assertEqual({tool.name for tool in listing.tools}, {
                "read_budget", "create_category", "update_category", "delete_category",
                "create_entry", "update_entry", "delete_entry"})

            async def call(tool_name, **arguments):
                result = await client.call_tool(tool_name, arguments)
                self.assertFalse(result.is_error, str(result.content))
                return result.structured_content

            first = await call("read_budget")
            self.assertEqual(first["revision"], 0)
            self.assertFalse(first["initialized"])
            category = await call("create_category", name="Test section", type="investment", expected_revision=0)
            category_id = category["affected"]["id"]
            self.assertEqual(category["snapshot"]["finance_data"]["income"], [])
            await call("update_category", category_id=category_id, patch={"name": "Savings"}, expected_revision=1)
            entry = await call("create_entry", kind="item", category_id=category_id, name="Placeholder", expected_revision=2,
                               metadata={"infos": "Keep this", "billingPeriod": "Annual"})
            entry_id = entry["affected"]["id"]
            self.assertEqual(entry["affected"]["value"], 0)
            changed = await call("update_entry", kind="item", category_id=category_id, entry_id=entry_id,
                                 patch={"value": 250, "infos": None}, expected_revision=3)
            self.assertEqual(changed["snapshot"]["totals"]["investments"], 250)
            self.assertNotIn("infos", changed["affected"])
            self.assertEqual(changed["affected"]["billingPeriod"], "Annual")
            stale = await client.call_tool("update_entry", {"kind": "item", "category_id": category_id,
                                          "entry_id": entry_id, "patch": {"value": 999}, "expected_revision": 3})
            self.assertTrue(stale.is_error)
            self.assertIn("409", str(stale.content))
            populated = await client.call_tool("delete_category", {"category_id": category_id, "expected_revision": 4})
            self.assertTrue(populated.is_error)
            await call("delete_entry", kind="item", category_id=category_id, entry_id=entry_id, expected_revision=4)
            await call("delete_category", category_id=category_id, expected_revision=5)
            income = await call("create_entry", kind="income", name="Salary", value=1000, expected_revision=6)
            await call("update_entry", kind="income", entry_id=income["affected"]["id"], patch={"value": 1200}, expected_revision=7)
            await call("delete_entry", kind="income", entry_id=income["affected"]["id"], expected_revision=8)
            empty = await call("read_budget")
            self.assertTrue(empty["initialized"])
            self.assertEqual(empty["finance_data"], {"income": [], "categories": []})
            self.assertEqual(empty["revision"], 9)
            self.process.terminate(); self.process.wait(timeout=10)
            type(self).start_backend()
            reloaded = await call("read_budget")
            self.assertEqual(reloaded["finance_data"], empty["finance_data"])
            self.assertEqual(reloaded["revision"], 9)


if __name__ == "__main__":
    unittest.main()

