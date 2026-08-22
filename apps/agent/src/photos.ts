import * as FileSystem from "expo-file-system";

export async function persistQueuePhoto(uri: string, kind: "result_sheet" | "incident") {
  const dir = `${FileSystem.documentDirectory}ccc-queue-photos/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const dest = `${dir}${kind}-${Date.now()}.jpg`;
  await FileSystem.copyAsync({ from: uri, to: dest });
  return dest;
}
