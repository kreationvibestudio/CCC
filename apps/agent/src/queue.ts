import * as SQLite from "expo-sqlite";
import { agentApi } from "./api";
import { localPhoto, publicPayload } from "./payload";

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

async function send(action: QueueAction, payload: Record<string, unknown>) {
  const body = { ...payload };
  const photo = localPhoto(body);
  if (photo) {
    const url = await agentApi.upload(photo.uri, photo.kind);
    if (photo.kind === "result_sheet") body.result_sheet_url = url;
    else body.media_url = url;
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
