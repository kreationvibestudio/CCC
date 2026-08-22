import { Pressable, StyleSheet, Text } from "react-native";
import { colors } from "../theme";

export function Chip({
  label,
  selected,
  onPress,
  tone = "default",
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  tone?: "default" | "danger";
}) {
  const active = selected
    ? tone === "danger"
      ? styles.dangerOn
      : styles.on
    : styles.off;
  const text = selected ? styles.onText : styles.offText;
  return (
    <Pressable onPress={onPress} style={[styles.chip, active]}>
      <Text style={text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  off: { borderColor: colors.border, backgroundColor: colors.card },
  on: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  dangerOn: { borderColor: colors.danger, backgroundColor: "#3f1212" },
  offText: { color: colors.muted, fontSize: 13 },
  onText: { color: colors.text, fontSize: 13, fontWeight: "600" },
});
