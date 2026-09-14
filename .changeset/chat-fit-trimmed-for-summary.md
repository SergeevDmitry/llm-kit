---
'chat-fit': minor
---

Add `FitChatReport.trimmedForSummaryIndexes`, naming the messages given up to make room for a summary.

Under `strategy: 'summarize-middle'` the summarizer only sees the dropped middle range. When the summary it returns still does not fit, the newest kept messages are trimmed next, and no summary replaces those. `report.summarizedRange.messageCount` counts the range alone, so it accounted for fewer removals than `report.removedIndexes` actually listed, and no warning said so.

The new field names the rest. It is present exactly when `summarizedRange` is and empty when nothing extra was given up, so `summarizedRange.messageCount + trimmedForSummaryIndexes.length === removedIndexes.length` holds whenever a range was summarized; a non-empty value also appears in `report.warnings`. `summarizedRange` is not widened to cover these messages, since the summarizer never read them.
