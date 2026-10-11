"""Local MCP tools for one personal BudgetFlow installation. No database access."""
import json
import os
from typing import Annotated, Any, Literal
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

from mcp.server import MCPServer
from mcp.server.mcpserver.exceptions import ToolError
from mcp.types import ToolAnnotations
from pydantic import BaseModel, ConfigDict, Field


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None  # Never forward the credential to a redirected host.


class BudgetClient:
    def __init__(self, url: str, token: str):
        parsed = urlsplit(url)
        if (parsed.scheme not in ("http", "https") or not parsed.hostname
                or parsed.username or parsed.password or parsed.query or parsed.fragment
                or "${" in url):
            raise ValueError("Set BUDGETFLOW_URL to the reachable HTTP(S) app URL")
        if len(token) < 32 or "${" in token or "\n" in token or "\r" in token:
            raise ValueError("Set BUDGETFLOW_API_TOKEN to a dedicated random token of at least 32 characters")
        self.url, self.token = url.rstrip("/"), token
        self.http = build_opener(NoRedirect())

    def request(self, path: str, action: dict[str, Any] | None = None) -> dict[str, Any]:
        write = action is not None
        req = Request(self.url + path, data=json.dumps(action, allow_nan=False).encode() if write else None,
                      headers={"Authorization": "Bearer " + self.token, "Content-Type": "application/json"},
                      method="POST" if write else "GET")
        try:
            with self.http.open(req, timeout=10) as response:
                return json.load(response)
        except HTTPError as error:
            if error.code >= 500 and write:
                raise ToolError("Server error; the write outcome is uncertain. Read the budget before deciding whether to retry.") from None
            try:
                detail = json.loads(error.read()).get("error", f"HTTP {error.code}")
            except (ValueError, AttributeError):
                detail = f"HTTP {error.code}"
            raise ToolError(f"BudgetFlow HTTP {error.code}: {detail}") from None
        except (URLError, TimeoutError, OSError, ValueError):
            detail = ("Write outcome is uncertain. Read the budget before deciding whether to retry."
                      if write else "Cannot read BudgetFlow. Check its URL and availability.")
            raise ToolError(detail) from None


class Patch(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CategoryPatch(Patch):
    name: str | None = None
    color: str | None = None
    type: Literal["expense", "investment"] | None = None


class EntryPatch(Patch):
    name: str | None = None
    value: Annotated[float, Field(ge=0, allow_inf_nan=False)] | None = None
    icon: str | None = None
    startDate: str | None = None
    endDate: str | None = None
    infos: str | None = None
    cancellationDate: str | None = None
    billingPeriod: Literal["Monthly", "Annual"] | None = None
    noticePeriod: str | None = None


class ItemMetadata(Patch):
    icon: str | None = None
    startDate: str | None = None
    endDate: str | None = None
    infos: str | None = None
    cancellationDate: str | None = None
    billingPeriod: Literal["Monthly", "Annual"] | None = None
    noticePeriod: str | None = None


Revision = Annotated[int, Field(ge=0, strict=True)]
Kind = Literal["income", "item"]


def build_server(client: BudgetClient) -> MCPServer:
    mcp = MCPServer("BudgetFlow", instructions="Read the saved budget before editing. Use stable IDs and its revision; clarify ambiguous labels. Each mutation returns a new snapshot. On conflicts read again; never repeat an uncertain write blindly. These tools read saved data, not unsaved browser edits.")
    read = ToolAnnotations(readOnlyHint=True, destructiveHint=False, idempotentHint=True, openWorldHint=True)
    create = ToolAnnotations(readOnlyHint=False, destructiveHint=False, idempotentHint=False, openWorldHint=True)
    change = ToolAnnotations(readOnlyHint=False, destructiveHint=True, idempotentHint=False, openWorldHint=True)

    def action(operation: str, expected_revision: int, **fields: Any):
        return client.request("/api/assistant/actions", {"operation": operation, "expected_revision": expected_revision,
                                                       **{key: value for key, value in fields.items() if value is not None}})

    @mcp.tool(annotations=read)
    def read_budget() -> dict[str, Any]:
        """Read all saved income, categories, entries, metadata, preferences, totals, IDs and revision. Investments are items in investment categories."""
        return client.request("/api/assistant/budget")

    @mcp.tool(annotations=create)
    def create_category(name: str, expected_revision: Revision, type: Literal["expense", "investment"] = "expense", color: str = "#64B5F6") -> dict[str, Any]:
        """Create an empty section. Use the latest read revision; names need not be unique."""
        return action("create_category", expected_revision, name=name, type=type, color=color)

    @mcp.tool(annotations=change)
    def update_category(category_id: str, patch: CategoryPatch, expected_revision: Revision) -> dict[str, Any]:
        """Edit specified category fields, preserving its entries. Omit unchanged fields."""
        return action("update_category", expected_revision, category_id=category_id, patch=patch.model_dump(exclude_unset=True))

    @mcp.tool(annotations=change)
    def delete_category(category_id: str, expected_revision: Revision) -> dict[str, Any]:
        """Delete an empty section by ID. Populated sections must have their entries removed first."""
        return action("delete_category", expected_revision, category_id=category_id)

    @mcp.tool(annotations=create)
    def create_entry(kind: Kind, name: str, expected_revision: Revision, value: Annotated[float, Field(ge=0, allow_inf_nan=False)] = 0, category_id: str | None = None, metadata: ItemMetadata | None = None) -> dict[str, Any]:
        """Create income or a category item. Zero creates a placeholder. Items require category_id; only items accept metadata. Stored values follow the app's amount semantics."""
        return action("create_entry", expected_revision, kind=kind, name=name, value=value, category_id=category_id,
                      metadata=metadata.model_dump(exclude_none=True) if metadata is not None else None)

    @mcp.tool(annotations=change)
    def update_entry(kind: Kind, entry_id: str, patch: EntryPatch, expected_revision: Revision, category_id: str | None = None) -> dict[str, Any]:
        """Edit specified entry fields using IDs. Items require category_id. Income permits only name/value; items also accept metadata. Null clears optional metadata; omitted fields remain unchanged."""
        return action("update_entry", expected_revision, kind=kind, entry_id=entry_id, category_id=category_id,
                      patch=patch.model_dump(exclude_unset=True))

    @mcp.tool(annotations=change)
    def delete_entry(kind: Kind, entry_id: str, expected_revision: Revision, category_id: str | None = None) -> dict[str, Any]:
        """Remove exactly one entry by ID. Items require their category_id."""
        return action("delete_entry", expected_revision, kind=kind, entry_id=entry_id, category_id=category_id)

    return mcp


if __name__ == "__main__":
    build_server(BudgetClient(os.environ.get("BUDGETFLOW_URL", ""), os.environ.get("BUDGETFLOW_API_TOKEN", ""))).run(transport="stdio")

