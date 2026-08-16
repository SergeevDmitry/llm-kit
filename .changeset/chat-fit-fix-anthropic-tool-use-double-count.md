---
'chat-fit': patch
---

Fix the default token counter charging an Anthropic-shaped `tool_use` block twice — once via the content walk's unknown-shape fallback, once via the tool-call overhead/name/input accounting — inflating tool-heavy Anthropic conversations by roughly 3x and trimming them far more aggressively than the budget requires. The same content walk also flagged every well-formed `tool_use`/`tool_result` block as an "unrecognized part" in `report.warnings`, contradicting the README's claim that both are read directly; `tool_result` blocks are now counted from their own inner content plus a small framing overhead instead of the flat unknown-shape estimate, and neither block type generates a fallback warning anymore.
