---
'chat-fit': patch
---

Hand the summarizer its range in conversation order. Under `strategy: 'summarize-middle'`, `SummaryRequest.messages` was built by flattening the dropped groups one at a time. Groups sort by their first index, but a tool-call group's messages need not be contiguous: parallel calls can have their results interleaved with other turns, and two assistant turns' calls can come back reversed. The summarizer then read a reply ahead of the turn it answered. It now gets the range ordered by original index, the same ordering the result itself gets.
