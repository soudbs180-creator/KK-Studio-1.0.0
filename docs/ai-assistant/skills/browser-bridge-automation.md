Status: reference

# Browser Bridge Automation Skill

- **Trigger phrases**: "打开浏览器助手", "检查 Chrome 插件连接", "抓取这个商品链接的价格和主图", "网页直通多账号生图", "保存到小红书草稿", "回写网页 DOM".
- **Tools**:
  - `browser.getStatus`
  - `browser.openAssistant`
  - `browser.extractProduct`
  - `browser.generateExternal`
  - `browser.publishDraft`
  - `browser.inspectPage`
  - `browser.openDesktopProject`
  - `browser.checkLocalLlm`
  - `browser.writeBackDom`

## Execution Rules

1. Browser automation must stay inside the existing `IntentGate -> Planner -> ToolRegistry -> PermissionPolicy -> Executor -> Verification -> Memory / Knowledge Update` chain.
2. Do not emit raw selector-click scripts or simulate UI coordinates for external pages. Route external-page work through Browser Bridge tools only.
3. `browser.getStatus`, `browser.openAssistant`, and `browser.checkLocalLlm` are `safe` because they only read connection state, open the local setup view, or request a local gateway diagnostic through Browser Bridge.
4. `browser.extractProduct`, `browser.generateExternal`, `browser.inspectPage`, and `browser.openDesktopProject` are `confirm` tools. The confirmation card must explain target scope, expected output, external platform/session usage, visible viewport access, desktop IDE launch scope, and setup fallback.
5. `browser.inspectPage` and `browser.writeBackDom` accept only a public HTTP(S) URL frozen in the planned input. Dynamic targets such as `active_tab`, `current_tab`, `current_page`, focused/selected page or an unsigned opaque tab ID are invalid for AI plans. Browser Assistant may still resolve `active_tab` inside a direct user-click Bridge command because that path is not an Agent plan.
6. Native Bridge results remain bound to the owner and command that initiated them. Do not log a raw WebSocket message or broadcast raw `data`/`error` in a page-wide event.
7. An owner change must clear URL, extraction/OCR, Prompt, pipeline log, DOM edit, ZIP path and platform/session-derived UI state, advance an owner epoch, and rebuild the Worker. Every awaited callback checks the captured owner/epoch before it can update UI or import data to the canvas.
8. `browser.publishDraft` and `browser.writeBackDom` are `dangerous`. They must require a second explicit confirmation and describe the affected external draft/page fields before execution; draft publishing must never become a direct public post.
9. URL targets must pass Browser Bridge sanitization: only public `http` / `https` URLs are allowed; local files, browser internals, localhost, and private network hosts are blocked.
10. Payloads and audit logs must redact API keys, cookies, bearer tokens, JWTs, passwords, and long opaque tokens before storage.
9. If the local daemon or Chrome Bridge extension is disconnected, tools must return `setup_required` guidance instead of fake success data.

## Output Handling

- Product extraction may return title, price, main image URL, platform, and description summaries.
- External generation may enqueue or return image results from a user-authorized browser session pool.
- Page inspection may return sanitized palette, layout, OCR, and visible text summaries only; it must not return complete HTML, cookies, tokens, or full page source.
- Desktop IDE launch may return a queued/success/failure summary, but it must not expose a full local filesystem path.
- Local LLM diagnostics may return gateway/model health summaries only; they must not include API keys, bearer tokens, or full local paths.
- Social publishing must default to draft-only behavior; direct public publishing is not allowed in this skill.
- DOM write-back must never infer credentials, cookies, or hidden private fields from the external page.

## Test Coverage

- Protocol and redaction: `tests/unit/browser-bridge-protocol.test.ts`
- ToolRegistry contracts: `tests/unit/ai-assistant-tool-registry.test.ts`
- Intent routing and local brain mapping: `tests/unit/ai-takeover-intentGate.test.ts`
- Settings UI bridge routing: `tests/unit/browser-assistant-settings-rows-ui-system-contract.test.ts`
