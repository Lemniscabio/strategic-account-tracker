# Chat Persistence Design

**Date:** 2026-03-19
**Feature:** Persistent chat threads per account

---

## Schema

New `ChatThread` collection (`src/lib/models/chatThread.ts`):

```
{
  accountId: ObjectId (ref Account, required, indexed),
  title: String (required, auto-generated from first user message, truncated to 50 chars),
  messages: [{
    role: String (enum: "user", "model", required),
    content: String (required),
    sources: [{ title: String, url: String }]
  }],
  createdAt: Date,
  updatedAt: Date
}
```

## API Endpoints

All new files in `src/app/api/accounts/[id]/chats/`:

- `GET /api/accounts/[id]/chats` — list threads for account (returns: `_id`, `title`, `updatedAt`), sorted by `updatedAt` DESC
- `POST /api/accounts/[id]/chats` — create new empty thread with title, returns thread object
- `GET /api/accounts/[id]/chats/[threadId]` — load full thread with all messages
- `PUT /api/accounts/[id]/chats/[threadId]` — update thread (append/replace messages array)

## Frontend Changes

Modify `src/components/AiChat.tsx`:

**Thread list in chat panel:**
- Above the message area, show a compact thread selector
- Dropdown or small list showing past threads by title + date
- "New Chat" button to start a fresh thread
- Clicking a thread loads its messages

**Auto-save flow:**
1. When user opens chat and no threads exist → auto-create a thread on first message
2. After each AI response, PUT the full messages array to the thread
3. Thread title set from first user message content (truncated to 50 chars)

**State management:**
- `threads`: list of thread summaries (fetched on mount)
- `activeThreadId`: currently selected thread ID (null = new chat)
- On mount: fetch thread list, auto-select most recent if exists
- On "New Chat": set activeThreadId to null, clear messages

## Existing Chat Route

`POST /api/accounts/[id]/chat` — unchanged. It handles AI generation. Persistence is separate.

## Technical Notes

- Thread list fetch is lightweight (only title + updatedAt, no messages)
- No message limit per thread — the AI chat route already handles context windowing (last 10 messages)
- Deleting an account should cascade-delete its threads (add to existing DELETE handler)
