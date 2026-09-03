import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Chip } from "./Chip";
import { REPORT_TYPES, colors } from "../theme";

export type ReportAttachment = {
  uri: string;
  mediaType: "photo" | "video";
};

export function ReportForm({
  reportType,
  report,
  attachments,
  disabled,
  onType,
  onReport,
  onPickPhoto,
  onPickVideo,
  onRemoveAttachment,
  onSubmit,
}: {
  reportType: string;
  report: string;
  attachments: ReportAttachment[];
  disabled: boolean;
  onType: (value: string) => void;
  onReport: (value: string) => void;
  onPickPhoto: () => void;
  onPickVideo: () => void;
  onRemoveAttachment: (index: number) => void;
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
      <Text style={styles.hint}>Add a photo or short video to corroborate this report (optional).</Text>
      {attachments.map((item, index) => (
        <View key={`${item.uri}-${index}`} style={styles.attachmentRow}>
          {item.mediaType === "photo" ? (
            <Image source={{ uri: item.uri }} style={styles.preview} />
          ) : (
            <View style={styles.videoBadge}>
              <Text style={styles.videoText}>Video attached</Text>
            </View>
          )}
          <Pressable onPress={() => onRemoveAttachment(index)}>
            <Text style={styles.remove}>Remove</Text>
          </Pressable>
        </View>
      ))}
      <View style={styles.mediaActions}>
        <Pressable style={styles.secondary} onPress={onPickPhoto} disabled={attachments.length >= 3}>
          <Text style={styles.buttonText}>Take photo</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={onPickVideo} disabled={attachments.length >= 3}>
          <Text style={styles.buttonText}>Record video</Text>
        </Pressable>
      </View>
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
  preview: { height: 120, borderRadius: 10, backgroundColor: colors.card, flex: 1 },
  videoBadge: {
    flex: 1,
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: colors.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  videoText: { color: colors.text, fontWeight: "600" },
  attachmentRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  remove: { color: "#fca5a5", fontSize: 13 },
  mediaActions: { flexDirection: "row", gap: 8 },
  button: { backgroundColor: colors.primary, borderRadius: 10, padding: 12, alignItems: "center" },
  secondary: {
    flex: 1,
    backgroundColor: colors.primaryMuted,
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  disabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontWeight: "600" },
});
