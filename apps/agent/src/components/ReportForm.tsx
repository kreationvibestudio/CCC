import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Chip } from "./Chip";
import { REPORT_TYPES, colors } from "../theme";

export function ReportForm({
  reportType,
  report,
  disabled,
  onType,
  onReport,
  onSubmit,
}: {
  reportType: string;
  report: string;
  disabled: boolean;
  onType: (value: string) => void;
  onReport: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <View style={styles.block}>
      <Text style={styles.section}>Field report</Text>
      <View style={styles.wrap}>
        {REPORT_TYPES.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            selected={reportType === option.value}
            onPress={() => onType(option.value)}
          />
        ))}
      </View>
      <TextInput
        style={[styles.input, styles.area]}
        multiline
        placeholder="Report details…"
        placeholderTextColor={colors.muted}
        value={report}
        onChangeText={onReport}
      />
      <Text style={styles.hint}>Date and time are recorded automatically when you tap submit.</Text>
      <Pressable style={[styles.button, disabled && styles.disabled]} disabled={disabled} onPress={onSubmit}>
        <Text style={styles.buttonText}>Submit report</Text>
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
  area: { minHeight: 88, textAlignVertical: "top" },
  button: { backgroundColor: colors.primary, borderRadius: 10, padding: 12, alignItems: "center" },
  disabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontWeight: "600" },
});
