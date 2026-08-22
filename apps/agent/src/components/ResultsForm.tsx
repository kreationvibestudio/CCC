import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { FEATURED_PARTIES, OTHER_MAJOR_PARTIES, totalPartyVotes, votesFromFields, type PartyOption } from "../parties";
import { colors } from "../theme";

function PartyRows({
  parties,
  votes,
  campaignParty,
  onChange,
}: {
  parties: PartyOption[];
  votes: Record<string, string>;
  campaignParty?: string;
  onChange: (code: string, value: string) => void;
}) {
  return (
    <View style={styles.list}>
      {parties.map((party) => (
        <View key={party.code} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.strong}>
              {party.code}
              {campaignParty && party.code === campaignParty ? " · your party" : ""}
            </Text>
            <Text style={styles.muted}>{party.name}</Text>
          </View>
          <TextInput
            style={[styles.input, styles.vote]}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={colors.muted}
            value={votes[party.code] ?? ""}
            onChangeText={(v) => onChange(party.code, v.replace(/[^\d]/g, ""))}
          />
        </View>
      ))}
    </View>
  );
}

export function ResultsForm({
  votes,
  extras,
  showOthers,
  sheetUri,
  campaignParty,
  featured,
  other,
  disabled,
  onVote,
  onExtras,
  onToggleOthers,
  onPickPhoto,
  onSubmit,
}: {
  votes: Record<string, string>;
  extras: { id: number; code: string; votes: string }[];
  showOthers: boolean;
  sheetUri: string | null;
  campaignParty?: string;
  featured: PartyOption[];
  other: PartyOption[];
  disabled: boolean;
  onVote: (code: string, value: string) => void;
  onExtras: (rows: { id: number; code: string; votes: string }[]) => void;
  onToggleOthers: () => void;
  onPickPhoto: () => void;
  onSubmit: () => void;
}) {
  const partyVotes = votesFromFields(votes, extras);
  const total = totalPartyVotes(partyVotes);
  const featuredList = featured.length ? featured : FEATURED_PARTIES;
  const otherList = other.length ? other : OTHER_MAJOR_PARTIES;

  return (
    <View style={styles.block}>
      <Text style={styles.section}>Result sheet</Text>
      <Text style={styles.hint}>Enter votes from the result sheet. Leave blank for 0. APC, PDP, NDC, and ADC are listed first.</Text>
      <PartyRows parties={featuredList} votes={votes} campaignParty={campaignParty} onChange={onVote} />
      <Pressable onPress={onToggleOthers}>
        <Text style={styles.link}>{showOthers ? "Hide other parties" : "Show other major parties"}</Text>
      </Pressable>
      {showOthers ? <PartyRows parties={otherList} votes={votes} campaignParty={campaignParty} onChange={onVote} /> : null}
      {extras.map((row) => (
        <View key={row.id} style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Party code"
            placeholderTextColor={colors.muted}
            autoCapitalize="characters"
            value={row.code}
            onChangeText={(code) =>
              onExtras(extras.map((item) => (item.id === row.id ? { ...item, code: code.toUpperCase() } : item)))
            }
          />
          <TextInput
            style={[styles.input, styles.vote]}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={colors.muted}
            value={row.votes}
            onChangeText={(value) =>
              onExtras(extras.map((item) => (item.id === row.id ? { ...item, votes: value.replace(/[^\d]/g, "") } : item)))
            }
          />
        </View>
      ))}
      <Pressable
        style={styles.secondary}
        onPress={() => onExtras([...extras, { id: Date.now(), code: "", votes: "" }])}
      >
        <Text style={styles.buttonText}>Add another party</Text>
      </Pressable>
      <Text style={styles.strong}>Total valid votes: {total.toLocaleString()}</Text>
      {sheetUri ? <Image source={{ uri: sheetUri }} style={styles.preview} /> : null}
      <Pressable style={styles.secondary} onPress={onPickPhoto}>
        <Text style={styles.buttonText}>{sheetUri ? "Retake sheet photo" : "Photograph result sheet"}</Text>
      </Pressable>
      <Text style={styles.hint}>Date and time are recorded automatically when you tap submit.</Text>
      <Pressable style={[styles.button, disabled && styles.disabled]} disabled={disabled} onPress={onSubmit}>
        <Text style={styles.buttonText}>Submit results</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8 },
  list: { gap: 6 },
  section: { color: colors.text, fontSize: 16, fontWeight: "600" },
  hint: { color: colors.muted, fontSize: 12 },
  link: { color: "#93c5fd", fontSize: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  strong: { color: "#e2e8f0", fontWeight: "600" },
  muted: { color: colors.muted, fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    color: colors.text,
    padding: 10,
    backgroundColor: colors.card,
  },
  vote: { width: 90, textAlign: "right" },
  preview: { height: 160, borderRadius: 10, backgroundColor: colors.card },
  button: { backgroundColor: colors.primary, borderRadius: 10, padding: 12, alignItems: "center" },
  secondary: { backgroundColor: colors.primaryMuted, borderRadius: 10, padding: 12, alignItems: "center" },
  disabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontWeight: "600" },
});
