import * as FileSystem from "expo-file-system";
import type { AgentMediaKind } from "./payload";

export async function persistQueueMedia(
  uri: string,
  kind: AgentMediaKind,
  mediaType: "photo" | "video" = "photo"
) {
  const dir = `${FileSystem.documentDirectory}ccc-queue-media/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const ext = mediaType === "video" ? "mp4" : "jpg";
  const dest = `${dir}${kind}-${Date.now()}.${ext}`;
  await FileSystem.copyAsync({ from: uri, to: dest });
  return dest;
}

/** @deprecated use persistQueueMedia */
export async function persistQueuePhoto(uri: string, kind: AgentMediaKind) {
  return persistQueueMedia(uri, kind, "photo");
}
