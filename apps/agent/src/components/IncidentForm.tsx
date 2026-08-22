import { Image, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { Chip } from "./Chip";
import { SEVERITIES, colors } from "../theme";

export function IncidentForm({
  title,
  description,
  severity,
  emergency,
  photoUri,
  disabled,
  onTitle,
  onDescription,
  onSeverity,
  onEmergency,
  onPickPhoto,
  onSubmit,
}: {
  title: string;
  description: string;
  severity: string;
  emergency: boolean;
  photoUri: string | null;
  disabled: boolean;
  onTitle: (value: string) => void;
  onDescription: (value: string) => void;
  onSeverity: (value: string) => void;
  onEmergency: (value: boolean) => void;
  onPickPhoto: () => void;
  onSubmit: () => void;
}) {
  return (
    <View style={styles.block}>
      <Text style={[styles.section, { color: colors.dangerText }]}>Report incident</Text>
      <TextInput
        style={styles.input}
        placeholder="Title"
        placeholderTextColor={colors.muted}
        value={title}
        onChangeText={onTitle}
      />
      <TextInput
        style={[styles.input, styles.area]}
        multiline
        placeholder="What happened"
        placeholderTextColor={colors.muted}
        value={description}
        onChangeText={onDescription}
      />
      <View style={styles.wrap}>
        {SEVERITIES.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            selected={severity === option.value}
            tone="danger"
            onPress={() => onSeverity(option.value)}
          />
        ))}
      </View>
      <View style={styles.row}>
        <Text style={styles.muted}>Emergency</Text>
        <Switch value={emergency} onValueChange={onEmergency} />
      </View>
      {photoUri ? <Image source={{ uri: photoUri }} style={styles.preview} /> : null}
      <Pressable style={styles.secondary} onPress={onPickPhoto}>
        <Text style={styles.buttonText}>{photoUri ? "Retake photo" : "Photograph incident"}</Text>
      </Pressable>
      <Text style={styles.hint}>Date and time are recorded automatically when you tap submit.</Text>
      <Pressable style={[styles.button, disabled && styles.disabled]} disabled={disabled} onPress={onSubmit}>
        <Text style={styles.buttonText}>Report incident</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8 },
  section: { fontSize: 16, fontWeight: "600" },
  wrap: { flexDirection: "row", flexWrap: "wrap" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  muted: { color: colors.muted, fontSize: 13 },
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
  preview: { height: 160, borderRadius: 10, backgroundColor: colors.card },
  button: { backgroundColor: colors.danger, borderRadius: 10, padding: 12, alignItems: "center" },
  secondary: { backgroundColor: colors.primaryMuted, borderRadius: 10, padding: 12, alignItems: "center" },
  disabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontWeight: "600" },
});
