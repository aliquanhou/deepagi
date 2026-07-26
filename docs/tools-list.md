# DeepAGI Tool List

Total: **44 tools** (across 7 categories)

## Core Tools (10)

| Name | Concurrent | Read-only | Description |
|---|---|---|---|
| `bash` | ❌ | * | Execute shell commands |
| `read` | ✅ | ✅ | Read file contents |
| `write` | ❌ | ❌ | Create/overwrite files |
| `edit` | ❌ | ❌ | Exact string replacement |
| `glob` | ✅ | ✅ | File pattern matching |
| `grep` | ✅ | ✅ | Content search (regex) |
| `web_fetch` | ✅ | ✅ | Fetch web page content |
| `web_search` | ✅ | ✅ | Search the web |
| `ask_user` | ❌ | ❌ | Ask user a question |
| `agent` | ❌ | ❌ | Create sub-agent |

## Task Tools (7)

| Name | Description |
|---|---|
| `task_create` | Create a tracked task |
| `task_get` | Get task details |
| `task_update` | Update task status |
| `task_list` | List all tasks |
| `task_stop` | Stop a running task |
| `task_output` | Read background task output |
| `todo_write` | Append todo item |

## Plan Tools (2)

| Name | Description |
|---|---|
| `enter_plan_mode` | Create/update implementation plan |
| `exit_plan_mode` | Exit plan mode, begin implementation |

## MCP Tools (3)

| Name | Description |
|---|---|
| `list_mcp_resources` | List MCP server resources |
| `read_mcp_resource` | Read MCP resource content |
| `tool_search` | Search available tools |

## Data Tools (2)

| Name | Description |
|---|---|
| `notebook_edit` | Edit Jupyter notebook cells |
| `config` | Read/modify project configuration |

## Cron Tools (3)

| Name | Description |
|---|---|
| `cron_create` | Schedule recurring/one-shot task |
| `cron_delete` | Cancel scheduled job |
| `cron_list` | List scheduled jobs |

## Specialized Tools (17)

| Name | Description |
|---|---|
| `skill` | Invoke registered skill |
| `sleep` | Wait before checking notifications |
| `snip` | Truncate conversation history |
| `ctx_inspect` | Inspect collapsed context |
| `monitor` | Start monitoring process/log |
| `web_browser` | Headless browser control |
| `brief` | Give concise instruction |
| `lsp` | Language Server Protocol (code intelligence) |
| `powershell` | Execute PowerShell (Windows) |
| `terminal_capture` | Capture terminal output |
| `send_message` | Send message to agent/teammate |
| `team_create` | Create agent team |
| `team_delete` | Delete agent team |
| `testing_permission` | Permission testing helper |
| `overflow_test` | Context overflow testing |
| `verify_plan` | Verify plan execution |
