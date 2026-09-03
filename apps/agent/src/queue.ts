import * as SQLite from "expo-sqlite";
import { agentApi } from "./api";
import { localMediaList, publicPayload } from "./payload";

export type QueueAction = "status" | "report" | "results" | "incident";

export type QueueItem = {
  id: number;
  action: QueueAction;
  payload: Record<string, unknown>;
  created_at: number;
};

let db: SQLite.SQLiteDatabase | null = null;

function database() {
  if (!db) {
    db = SQLite.openDatabaseSync("ccc-agent-queue.db");
    db.execSync(
      "CREATE TABLE IF NOT EXISTS queue (id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT NOT NULL, payload TEXT NOT NULL, created_at INTEGER NOT NULL)"
    );
  }
  return db;
}

export function enqueue(action: QueueItem["action"], payload: Record<string, unknown>) {
  database().runSync("INSERT INTO queue (action, payload, created_at) VALUES (?, ?, ?)", [
    action,
    JSON.stringify(payload),
    Date.now(),
  ]);
}

export function listQueue(): QueueItem[] {
  const rows = database().getAllSync<{ id: number; action: QueueItem["action"]; payload: string; created_at: number }>(
    "SELECT id, action, payload, created_at FROM queue ORDER BY id"
  );
  return rows.map((row) => ({
    ...row,
    payload: JSON.parse(row.payload) as Record<string, unknown>,
  }));
}

export function removeQueued(id: number) {
  database().runSync("DELETE FROM queue WHERE id = ?", [id]);
}

export function queuedCount() {
  const row = database().getFirstSync<{ n: number }>("SELECT COUNT(*) as n FROM queue");
  return row?.n ?? 0;
}

async function attachUploadedMedia(body: Record<string, unknown>, action: QueueAction) {
  const mediaItems: Array<{ url: string; media_type: "photo" | "video" }> = [];
  for (const item of localMediaList(body)) {
    const uploaded = await agentApi.upload(item.uri, item.kind, item.mediaType);
    if (item.kind === "result_sheet") {
      body.result_sheet_url = uploaded.url;
      continue;
    }
    if (item.kind === "incident") {
      body.media_url = uploaded.url;
      body.media_type = uploaded.media_type;
      continue;
    }
    if (item.kind === "report") {
      mediaItems.push({ url: uploaded.url, media_type: uploaded.media_type });
    }
  }
  if (action === "report" && mediaItems.length) {
    body.media_items = mediaItems;
  }
}

async function send(action: QueueAction, payload: Record<string, unknown>) {
  const body = { ...payload };
  if (localMediaList(body).length) {
    await attachUploadedMedia(body, action);
  }
  const publicBody = publicPayload(body);
  if (action === "status") await agentApi.status(publicBody);
  if (action === "report") await agentApi.report(publicBody);
  if (action === "results") await agentApi.results(publicBody);
  if (action === "incident") await agentApi.incident(publicBody);
}

export async function flushQueue(): Promise<{ synced: number; remaining: number }> {
  const items = listQueue();
  let synced = 0;
  for (const item of items) {
    try {
      await send(item.action, item.payload);
      removeQueued(item.id);
      synced += 1;
    } catch {
      break;
    }
  }
  return { synced, remaining: queuedCount() };
}
