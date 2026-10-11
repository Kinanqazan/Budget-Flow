# BudgetFlow tools for Hermes

Hermes starts this small local MCP adapter. It reads and changes BudgetFlow through the app's backend; it never opens the database. There is no separate MCP port or background service.

Seven tools cover reading the whole saved budget and creating, editing or deleting categories and entries. Zero-value entries are placeholders. Investment entries belong to investment categories. Deleting a populated category is refused; delete its entries first. Moving and reordering remain in the app interface.

## Connect the personal installation

1. Deploy the updated frontend **and** backend together. Keep the existing data volume. The database migration adds a revision without changing budget values. Old open browser tabs must refresh; their saves without revisions are rejected.
2. Generate a dedicated token, for example with `python3 -c 'import secrets; print(secrets.token_hex(32))'`. Set it as `ASSISTANT_API_TOKEN` in BudgetFlow's server environment, then restart/recreate its container. The Compose example passes this variable through. Empty means assistant access is disabled, including in preview mode.
3. Copy `server.py`, `requirements.txt` and the config example to `/opt/budgetflow-mcp` on the machine/container running Hermes. Install in an isolated Python 3.10+ environment:

   ```sh
   cd /opt/budgetflow-mcp
   python3 -m venv .venv
   .venv/bin/python -m pip install -r requirements.txt
   ```

4. In the active Hermes profile's secret environment, set `BUDGETFLOW_API_TOKEN` to the same token and `BUDGETFLOW_URL` to the reachable app URL. Merge `hermes-config.example.yaml` into that profile's config. Adjust its absolute paths to the actual installation. When Hermes runs in Docker, these paths and environment values must exist inside its container; `localhost` refers to that container.
5. Run `hermes mcp test budgetflow`, then reload MCP/start a fresh Hermes session. Ask it to read the budget first. A connection test must run in the profile/gateway that actually hosts your assistant.

Use HTTPS across machines; plain HTTP is appropriate for loopback or an isolated container network. Certificate verification stays enabled. The adapter refuses credential-bearing URLs and redirects, and does not retry mutations automatically.

The token grants budget tools only. It cannot log in or delete the account. In authenticated mode, exactly one account must be set up. To revoke/rotate access, remove/change `ASSISTANT_API_TOKEN` and restart BudgetFlow, then update the Hermes secret and reconnect its adapter. Rotate it when resetting/recreating the account. No OAuth or token-management screen is needed for this personal setup.

## Editing and synchronization

Tools return stable IDs and a revision. Hermes must use that revision for the next change. On a conflict it reads again; after a lost response it reads to determine whether the requested change already happened before retrying.

The app refreshes a clean view on focus and every ten seconds while visible. Browser saves also check revisions. Conflicts preserve local edits and pause saves; the interface offers exporting those edits or explicitly loading the saved budget. Loading replaces the local draft. Saved empty and zero-value budgets remain empty/zero after reload.

Only saved data is exposed. Category type, item metadata, display preferences, and unrelated records are preserved. Amounts and totals use the app's existing rules, including its current interpretation of Annual labels.

## Verification

From the repository root:

```sh
npm test -- --pool=threads --maxWorkers=1 --minWorkers=1
npm run build
npm run build:server
# Use the Python environment containing requirements.txt:
python integrations/hermes-mcp/test_server.py -v
```

The Python tests create a disposable backend and a real stdio MCP client/server connection, discover and call all seven tools, verify conflicts, and restart the backend to verify persistence. They never connect to the personal app. Backend tests exercise SQLite and JSON storage; browser tests cover pending edits and stale responses. The native `better-sqlite3` binding is unavailable in the current Windows checkout, so automated SQLite coverage uses Node's built-in SQLite engine with the same SQL.

Current repository checks pass for tests, frontend/backend builds and lint on changed files. Whole-project lint and frontend `tsc` still report existing findings in unchanged files (including unused UI components with missing dependencies). Live Hermes/home-server acceptance remains separate from these local checks.

References: [Hermes MCP configuration](https://hermes-agent.nousresearch.com/docs/reference/mcp-config-reference/), [official Python MCP SDK](https://py.sdk.modelcontextprotocol.io/).
