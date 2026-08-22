import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Chip } from "./Chip";
import { STATUS_OPTIONS, colors } from "../theme";

export function StatusForm({
  status,
  turnout,
  disabled,
  onStatus,
  onTurnout,
  onSubmit,
}: {
  status: string;
  turnout: string;
  disabled: boolean;
  onStatus: (value: string) => void;
  onTurnout: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <View style={styles.block}>
      <Text style={styles.section}>PU status & turnout</Text>
      <View style={styles.wrap}>
        {STATUS_OPTIONS.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            selected={status === option.value}
            onPress={() => onStatus(option.value)}
          />
        ))}
      </View>
      <TextInput
        style={styles.input}
        keyboardType="number-pad"
        placeholder="Turnout count"
        placeholderTextColor={colors.muted}
        value={turnout}
        onChangeText={(v) => onTurnout(v.replace(/[^\d]/g, ""))}
      />
      <Text style={styles.hint}>Date and time are recorded automatically when you tap submit.</Text>
      <Pressable style={[styles.button, disabled && styles.disabled]} disabled={disabled} onPress={onSubmit}>
        <Text style={styles.buttonText}>Update status</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8 },
  section: { color: colors.text, fontSize: 16, fontWeight: "600" },
  wrap: { flexDirection: "row", flexWrap: "wrap" },
  hint: { color: colors.muted, fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    color: colors.text,
    padding: 10,
    backgroundColor: colors.card,
  },
  button: { backgroundColor: colors.primary, borderRadius: 10, padding: 12, alignItems: "center" },
  disabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontWeight: "600" },
});
