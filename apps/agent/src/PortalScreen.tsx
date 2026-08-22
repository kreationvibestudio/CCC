import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import NetInfo from "@react-native-community/netinfo";
import { agentApi, type AgentUnit } from "./api";
import { FEATURED } from "./config";
import { enqueue, listQueue, queuedCount, removeQueued } from "./queue";
import { signOut } from "./session";
import { registerPushToken } from "./push";

function lagosNow() {
  return new Date().toLocaleString("en-NG", { timeZone: "Africa/Lagos" });
}

export function PortalScreen({ onSignOut }: { onSignOut: () => void }) {
  const [online, setOnline] = useState(true);
  const [busy, setBusy] = useState(false);
  const [queued, setQueued] = useState(0);
  const [assigned, setAssigned] = useState<AgentUnit[]>([]);
  const [nearby, setNearby] = useState<AgentUnit[]>([]);
  const [selected, setSelected] = useState<AgentUnit | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<AgentUnit[]>([]);
  const [status, setStatus] = useState("voting_in_progress");
  const [turnout, setTurnout] = useState("");
  const [reportType, setReportType] = useState("observation");
  const [report, setReport] = useState("");
  const [votes, setVotes] = useState<Record<string, string>>({});
  const [sheetUri, setSheetUri] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [emergency, setEmergency] = useState(false);
  const [incidentUri, setIncidentUri] = useState<string | null>(null);
  const [who, setWho] = useState("");

  const puId = selected?.id ?? "";

  const refreshQueue = useCallback(() => setQueued(queuedCount()), []);

  const flush = useCallback(async () => {
    const items = listQueue();
    for (const item of items) {
      try {
        if (item.action === "status") await agentApi.status(item.payload);
        if (item.action === "report") await agentApi.report(item.payload);
        if (item.action === "results") await agentApi.results(item.payload);
        if (item.action === "incident") await agentApi.incident(item.payload);
        removeQueued(item.id);
      } catch {
        break;
      }
    }
    refreshQueue();
  }, [refreshQueue]);

  useEffect(() => {
    const sub = NetInfo.addEventListener((state) => {
      const on = Boolean(state.isConnected);
      setOnline(on);
      if (on) void flush();
    });
    void agentApi.session().then((s) => setWho(s.full_name || s.email)).catch(() => undefined);
    void agentApi.assigned().then((r) => {
      setAssigned(r.units);
      if (r.units[0]) setSelected(r.units[0]);
    }).catch(() => undefined);
    void registerPushToken().catch(() => undefined);
    refreshQueue();
    return () => sub();
  }, [flush, refreshQueue]);

  async function useGps() {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") {
      Alert.alert("Location needed", "Allow location to pick the nearest polling unit.");
      return;
    }
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    setCoords({ lat, lng });
    const { units } = await agentApi.nearest(lat, lng);
    setNearby(units);
    if (units[0]) setSelected(units[0]);
  }

  async function search() {
    if (query.trim().length < 2) return;
    const { units } = await agentApi.search(query.trim());
    setHits(units);
    if (units.length === 1) setSelected(units[0]);
  }

  async function pickPhoto(kind: "result_sheet" | "incident") {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== "granted") {
      Alert.alert("Camera needed", "Allow camera to photograph the sheet or incident.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.6, allowsEditing: false });
    if (result.canceled || !result.assets[0]) return;
    if (kind === "result_sheet") setSheetUri(result.assets[0].uri);
    else setIncidentUri(result.assets[0].uri);
  }

  async function submit(
    action: "status" | "report" | "results" | "incident",
    payload: Record<string, unknown>
  ) {
    payload.captured_at = new Date().toISOString();
    if (!online) {
      enqueue(action, payload);
      refreshQueue();
      Alert.alert("Saved offline", "It will sync when you are back online.");
      return;
    }
    setBusy(true);
    try {
      if (action === "status") await agentApi.status(payload);
      if (action === "report") await agentApi.report(payload);
      if (action === "results") await agentApi.results(payload);
      if (action === "incident") await agentApi.incident(payload);
      Alert.alert("Submitted", lagosNow());
    } catch (e) {
      enqueue(action, payload);
      refreshQueue();
      Alert.alert("Saved offline", e instanceof Error ? e.message : "Will retry");
    } finally {
      setBusy(false);
    }
  }

  const voteTotal = useMemo(() => {
    return Object.values(votes).reduce((sum, raw) => sum + (Number(raw) || 0), 0);
  }, [votes]);

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.content}>
      <View style={styles.row}>
        <View>
          <Text style={styles.title}>Agent Portal</Text>
          <Text style={styles.muted}>{who || "Field reporting"} · {lagosNow()}</Text>
        </View>
        <Pressable onPress={async () => { await signOut(); onSignOut(); }}>
          <Text style={styles.link}>Sign out</Text>
        </Pressable>
      </View>
      <Text style={[styles.pill, online ? styles.online : styles.offline]}>
        {online ? "Online" : "Offline"}{queued ? ` · ${queued} queued` : ""}
      </Text>

      <Text style={styles.section}>Polling unit</Text>
      {assigned.map((u) => (
        <Pressable key={u.id} onPress={() => setSelected(u)} style={[styles.card, selected?.id === u.id && styles.selected]}>
          <Text style={styles.strong}>{u.pu_code || u.code} — {u.name}</Text>
          <Text style={styles.muted}>{u.ward}, {u.lga} · assigned</Text>
        </Pressable>
      ))}
      <Pressable style={styles.button} onPress={() => void useGps()}>
        <Text style={styles.buttonText}>Use GPS</Text>
      </Pressable>
      {nearby.map((u) => (
        <Pressable key={u.id} onPress={() => setSelected(u)} style={[styles.card, selected?.id === u.id && styles.selected]}>
          <Text style={styles.strong}>{u.pu_code || u.code} — {u.name}</Text>
          <Text style={styles.muted}>
            {u.ward}, {u.lga}
            {u.distance_m != null ? ` · ${Math.round(u.distance_m)} m` : ""}
          </Text>
        </Pressable>
      ))}
      <View style={styles.row}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="Search PU code"
          placeholderTextColor="#6b7280"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="characters"
        />
        <Pressable style={styles.button} onPress={() => void search()}>
          <Text style={styles.buttonText}>Search</Text>
        </Pressable>
      </View>
      {hits.map((u) => (
        <Pressable key={u.id} onPress={() => setSelected(u)} style={[styles.card, selected?.id === u.id && styles.selected]}>
          <Text style={styles.strong}>{u.pu_code || u.code} — {u.name}</Text>
          <Text style={styles.muted}>{u.ward}, {u.lga}</Text>
        </Pressable>
      ))}
      {selected ? (
        <Text style={styles.muted}>Selected: {selected.pu_code || selected.code}</Text>
      ) : (
        <Text style={styles.error}>Select a polling unit before submitting</Text>
      )}

      <Text style={styles.section}>PU status</Text>
      {["not_active", "voting_in_progress", "delayed", "minor_issue", "serious_incident"].map((s) => (
        <Pressable key={s} onPress={() => setStatus(s)}>
          <Text style={status === s ? styles.strong : styles.muted}>{s.replaceAll("_", " ")}</Text>
        </Pressable>
      ))}
      <TextInput
        style={styles.input}
        keyboardType="number-pad"
        placeholder="Turnout"
        placeholderTextColor="#6b7280"
        value={turnout}
        onChangeText={setTurnout}
      />
      <Pressable
        style={styles.button}
        disabled={busy || !puId}
        onPress={() =>
          void submit("status", {
            polling_unit_id: puId,
            status,
            turnout: Number(turnout) || 0,
          })
        }
      >
        <Text style={styles.buttonText}>Update status</Text>
      </Pressable>

      <Text style={styles.section}>Field report</Text>
      <TextInput
        style={styles.input}
        placeholder="Type (turnout / logistics / observation)"
        placeholderTextColor="#6b7280"
        value={reportType}
        onChangeText={setReportType}
      />
      <TextInput
        style={[styles.input, styles.area]}
        multiline
        placeholder="Details"
        placeholderTextColor="#6b7280"
        value={report}
        onChangeText={setReport}
      />
      <Pressable
        style={styles.button}
        disabled={busy || !puId}
        onPress={() =>
          void submit("report", { polling_unit_id: puId, report_type: reportType, content: report })
        }
      >
        <Text style={styles.buttonText}>Submit report</Text>
      </Pressable>

      <Text style={styles.section}>Result sheet</Text>
      {FEATURED.map((p) => (
        <View key={p.code} style={styles.row}>
          <Text style={[styles.muted, { flex: 1 }]}>{p.code}</Text>
          <TextInput
            style={[styles.input, { width: 90 }]}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor="#6b7280"
            value={votes[p.code] ?? ""}
            onChangeText={(v) => setVotes((prev) => ({ ...prev, [p.code]: v.replace(/[^\d]/g, "") }))}
          />
        </View>
      ))}
      <Text style={styles.muted}>Total {voteTotal.toLocaleString()}</Text>
      <Pressable style={styles.secondary} onPress={() => void pickPhoto("result_sheet")}>
        <Text style={styles.buttonText}>{sheetUri ? "Retake sheet photo" : "Photograph result sheet"}</Text>
      </Pressable>
      <Pressable
        style={styles.button}
        disabled={busy || !puId}
        onPress={async () => {
          const party_votes: Record<string, number> = {};
          for (const [code, raw] of Object.entries(votes)) {
            if (raw) party_votes[code] = Number(raw);
          }
          let result_sheet_url: string | undefined;
          if (sheetUri && online) {
            setBusy(true);
            try {
              result_sheet_url = await agentApi.upload(sheetUri, "result_sheet");
            } catch (e) {
              setBusy(false);
              Alert.alert("Photo upload failed", e instanceof Error ? e.message : "Try again");
              return;
            }
          }
          await submit("results", {
            polling_unit_id: puId,
            party_votes,
            result_sheet_url,
            latitude: coords?.lat,
            longitude: coords?.lng,
          });
        }}
      >
        <Text style={styles.buttonText}>Submit results</Text>
      </Pressable>

      <Text style={styles.section}>Incident</Text>
      <TextInput style={styles.input} placeholder="Title" placeholderTextColor="#6b7280" value={title} onChangeText={setTitle} />
      <TextInput
        style={[styles.input, styles.area]}
        multiline
        placeholder="What happened"
        placeholderTextColor="#6b7280"
        value={description}
        onChangeText={setDescription}
      />
      <TextInput style={styles.input} placeholder="Severity (low/medium/high/critical)" placeholderTextColor="#6b7280" value={severity} onChangeText={setSeverity} />
      <View style={styles.row}>
        <Text style={styles.muted}>Emergency</Text>
        <Switch value={emergency} onValueChange={setEmergency} />
      </View>
      <Pressable style={styles.secondary} onPress={() => void pickPhoto("incident")}>
        <Text style={styles.buttonText}>{incidentUri ? "Retake photo" : "Photograph incident"}</Text>
      </Pressable>
      <Pressable
        style={[styles.button, styles.danger]}
        disabled={busy}
        onPress={async () => {
          let media_url: string | undefined;
          if (incidentUri && online) {
            setBusy(true);
            try {
              media_url = await agentApi.upload(incidentUri, "incident");
            } catch (e) {
              setBusy(false);
              Alert.alert("Photo upload failed", e instanceof Error ? e.message : "Try again");
              return;
            }
          }
          await submit("incident", {
            polling_unit_id: puId || undefined,
            title,
            description,
            severity,
            is_emergency: emergency,
            media_url,
            latitude: coords?.lat,
            longitude: coords?.lng,
          });
        }}
      >
        <Text style={styles.buttonText}>Report incident</Text>
      </Pressable>
      {busy ? <ActivityIndicator color="#93c5fd" /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#0b1220" },
  content: { padding: 16, paddingBottom: 48, gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "space-between" },
  title: { color: "#f8fafc", fontSize: 22, fontWeight: "700" },
  section: { color: "#f8fafc", fontSize: 16, fontWeight: "600", marginTop: 16 },
  muted: { color: "#94a3b8", fontSize: 13 },
  strong: { color: "#e2e8f0", fontWeight: "600" },
  link: { color: "#93c5fd" },
  error: { color: "#f87171" },
  pill: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, overflow: "hidden" },
  online: { backgroundColor: "#14532d", color: "#bbf7d0" },
  offline: { backgroundColor: "#713f12", color: "#fde68a" },
  card: { borderWidth: 1, borderColor: "#1e293b", borderRadius: 10, padding: 10, backgroundColor: "#111827" },
  selected: { borderColor: "#2563eb" },
  input: {
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 10,
    color: "#f8fafc",
    padding: 10,
    backgroundColor: "#111827",
  },
  area: { minHeight: 72, textAlignVertical: "top" },
  button: { backgroundColor: "#2563eb", borderRadius: 10, padding: 12, alignItems: "center" },
  secondary: { backgroundColor: "#1e3a5f", borderRadius: 10, padding: 12, alignItems: "center" },
  danger: { backgroundColor: "#b91c1c" },
  buttonText: { color: "#fff", fontWeight: "600" },
});
