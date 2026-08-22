import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatLagos } from "../lagos";
import { colors } from "../theme";
import type { QueueItem } from "../queue";

export function QueueBar({
  online,
  items,
  syncing,
  onSync,
}: {
  online: boolean;
  items: QueueItem[];
  syncing: boolean;
  onSync: () => void;
}) {
  const queued = items.length;
  return (
    <View style={styles.wrap}>
      <Text style={[styles.pill, online ? styles.online : styles.offline]}>
        {online ? "Online" : "Offline"}
        {queued ? ` · ${queued} queued` : ""}
      </Text>
      {queued ? (
        <Pressable onPress={onSync} disabled={!online || syncing}>
          <Text style={styles.link}>{syncing ? "Syncing…" : "Sync now"}</Text>
        </Pressable>
      ) : null}
      {items.slice(0, 3).map((item) => (
        <Text key={item.id} style={styles.item}>
          {item.action} · {formatLagos(new Date(item.created_at))}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  pill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: "hidden",
    fontSize: 12,
  },
  online: { backgroundColor: colors.onlineBg, color: colors.onlineText },
  offline: { backgroundColor: colors.offlineBg, color: colors.offlineText },
  link: { color: "#93c5fd", fontWeight: "600" },
  item: { color: colors.muted, fontSize: 12 },
});
