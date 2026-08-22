import { useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as Location from "expo-location";
import { agentApi, type AgentUnit } from "../api";
import { formatDistance } from "../lagos";
import { colors } from "../theme";

function UnitCard({
  unit,
  selected,
  onSelect,
  badge,
}: {
  unit: AgentUnit;
  selected: boolean;
  onSelect: () => void;
  badge?: string;
}) {
  const dist = formatDistance(unit.distance_m);
  return (
    <Pressable onPress={onSelect} style={[styles.card, selected && styles.selected]}>
      <Text style={styles.strong}>
        {unit.pu_code || unit.code} — {unit.name}
      </Text>
      <Text style={styles.muted}>
        {unit.ward}, {unit.lga}
        {dist ? ` · ${dist}` : ""}
        {badge ? ` · ${badge}` : ""}
      </Text>
    </Pressable>
  );
}

export function PuPicker({
  assigned,
  selected,
  onSelect,
  coords,
  onCoords,
}: {
  assigned: AgentUnit[];
  selected: AgentUnit | null;
  onSelect: (unit: AgentUnit) => void;
  coords: { lat: number; lng: number } | null;
  onCoords: (coords: { lat: number; lng: number }) => void;
}) {
  const [gpsStatus, setGpsStatus] = useState<"idle" | "locating" | "ready" | "denied">("idle");
  const [nearby, setNearby] = useState<AgentUnit[]>([]);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<AgentUnit[]>([]);
  const [busy, setBusy] = useState(false);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  async function locate(force: boolean) {
    setGpsStatus("locating");
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") {
      setGpsStatus("denied");
      if (force) {
        Alert.alert("Location needed", "Allow location to pick the nearest polling unit, or search by PU code.");
      }
      return;
    }
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      onCoords({ lat, lng });
      setGpsStatus("ready");
      setBusy(true);
      const { units } = await agentApi.nearest(lat, lng);
      setNearby(units);
      if (!units[0]) {
        Alert.alert("No nearby unit", "No polling unit with coordinates near this location. Search by PU code.");
        return;
      }
      if (force || !selectedRef.current) onSelect(units[0]);
    } catch (e) {
      setGpsStatus("denied");
      Alert.alert("GPS failed", e instanceof Error ? e.message : "Try again or search by PU code");
    } finally {
      setBusy(false);
    }
  }

  async function search() {
    if (query.trim().length < 2) {
      Alert.alert("PU code", "Enter at least 2 characters of the PU code");
      return;
    }
    setBusy(true);
    try {
      const { units } = await agentApi.search(query.trim());
      setHits(units);
      if (!units.length) {
        Alert.alert("No match", "No polling unit matches that code");
        return;
      }
      if (units.length === 1) onSelect(units[0]);
    } catch (e) {
      Alert.alert("Search failed", e instanceof Error ? e.message : "Try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.block}>
      <Text style={styles.section}>Polling unit</Text>
      <Text style={styles.hint}>
        Uses your assigned unit when HQ has tied you to one. GPS and PU-code search remain available if you
        are sent to a different unit. The full national catalog is never downloaded.
      </Text>

      {selected ? (
        <View style={[styles.card, styles.selected]}>
          <Text style={styles.strong}>
            Selected: {selected.pu_code || selected.code} — {selected.name}
          </Text>
          <Text style={styles.muted}>
            {selected.ward}, {selected.lga}
            {formatDistance(selected.distance_m) ? ` · ${formatDistance(selected.distance_m)}` : ""}
          </Text>
        </View>
      ) : (
        <Text style={styles.error}>Select a polling unit before submitting</Text>
      )}

      <Pressable style={styles.button} onPress={() => void locate(true)} disabled={busy}>
        {busy && gpsStatus === "locating" ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>
            {gpsStatus === "locating"
              ? "Finding your position…"
              : coords
                ? `GPS ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)} — refresh`
                : "Use GPS to find polling unit"}
          </Text>
        )}
      </Pressable>

      {assigned.length > 0 ? (
        <View style={styles.group}>
          <Text style={styles.groupLabel}>Assigned to you</Text>
          {assigned.map((u) => (
            <UnitCard
              key={u.id}
              unit={u}
              selected={selected?.id === u.id}
              onSelect={() => onSelect(u)}
              badge="assigned"
            />
          ))}
        </View>
      ) : null}

      {nearby.length > 0 ? (
        <View style={styles.group}>
          <Text style={styles.groupLabel}>Nearest to you</Text>
          {nearby.map((u) => (
            <UnitCard key={u.id} unit={u} selected={selected?.id === u.id} onSelect={() => onSelect(u)} />
          ))}
        </View>
      ) : null}

      <Text style={styles.groupLabel}>Search by PU code</Text>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="e.g. 12/03/005 or ED/…"
          placeholderTextColor={colors.muted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <Pressable style={styles.button} onPress={() => void search()} disabled={busy}>
          <Text style={styles.buttonText}>Search</Text>
        </Pressable>
      </View>
      {hits.map((u) => (
        <UnitCard key={u.id} unit={u} selected={selected?.id === u.id} onSelect={() => onSelect(u)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8 },
  section: { color: colors.text, fontSize: 16, fontWeight: "600" },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  group: { gap: 6 },
  groupLabel: { color: colors.muted, fontSize: 12, fontWeight: "600", marginTop: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    backgroundColor: colors.card,
  },
  selected: { borderColor: colors.selected },
  strong: { color: "#e2e8f0", fontWeight: "600" },
  muted: { color: colors.muted, fontSize: 13 },
  error: { color: colors.dangerText },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    color: colors.text,
    padding: 10,
    backgroundColor: colors.card,
  },
  button: { backgroundColor: colors.primary, borderRadius: 10, padding: 12, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "600" },
});
