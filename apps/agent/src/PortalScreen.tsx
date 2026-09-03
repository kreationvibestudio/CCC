import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import NetInfo from "@react-native-community/netinfo";
import { AgentAuthError, agentApi, type AgentUnit, type SessionInfo } from "./api";
import { IncidentForm } from "./components/IncidentForm";
import { PuPicker } from "./components/PuPicker";
import { QueueBar } from "./components/QueueBar";
import { ReportForm, type ReportAttachment } from "./components/ReportForm";
import { ResultsForm } from "./components/ResultsForm";
import { StatusForm } from "./components/StatusForm";
import { formatLagos } from "./lagos";
import { FEATURED_PARTIES, OTHER_MAJOR_PARTIES, votesFromFields } from "./parties";
import { persistQueueMedia } from "./photos";
import { listenForHqNudges, registerPushToken } from "./push";
import { enqueue, flushQueue, listQueue, queuedCount, type QueueAction, type QueueItem } from "./queue";
import { signOut } from "./session";
import { colors } from "./theme";

type Tab = "unit" | "status" | "report" | "results" | "incident";

const TABS: { id: Tab; label: string }[] = [
  { id: "unit", label: "Unit" },
  { id: "status", label: "Status" },
  { id: "report", label: "Report" },
  { id: "results", label: "Results" },
  { id: "incident", label: "Incident" },
];

export function PortalScreen({ onSignOut }: { onSignOut: () => void }) {
  const [tab, setTab] = useState<Tab>("unit");
  const [online, setOnline] = useState(true);
  const [busy, setBusy] = useState(false);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [assigned, setAssigned] = useState<AgentUnit[]>([]);
  const [selected, setSelected] = useState<AgentUnit | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [status, setStatus] = useState("voting_in_progress");
  const [turnout, setTurnout] = useState("");
  const [reportType, setReportType] = useState("observation");
  const [report, setReport] = useState("");
  const [reportAttachments, setReportAttachments] = useState<ReportAttachment[]>([]);
  const [votes, setVotes] = useState<Record<string, string>>({});
  const [extras, setExtras] = useState<{ id: number; code: string; votes: string }[]>([]);
  const [showOthers, setShowOthers] = useState(true);
  const [sheetUri, setSheetUri] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [emergency, setEmergency] = useState(false);
  const [incidentUri, setIncidentUri] = useState<string | null>(null);
  const [who, setWho] = useState("");
  const [workspace, setWorkspace] = useState("");
  const [campaignParty, setCampaignParty] = useState("");
  const [featured, setFeatured] = useState(FEATURED_PARTIES);
  const [other, setOther] = useState(OTHER_MAJOR_PARTIES);
  const [clock, setClock] = useState(() => new Date());
  const [lastSubmit, setLastSubmit] = useState<string | null>(null);

  const puId = selected?.id ?? "";

  const refreshQueue = useCallback(() => setQueueItems(listQueue()), []);

  const sync = useCallback(async () => {
    const result = await flushQueue();
    refreshQueue();
    if (result.synced) {
      Alert.alert("Synced", `${result.synced} offline report(s) sent${result.remaining ? `; ${result.remaining} still queued` : ""}`);
    }
  }, [refreshQueue]);

  useEffect(() => {
    const tick = setInterval(() => setClock(new Date()), 1000);
    const stopNudges = listenForHqNudges();
    const sub = NetInfo.addEventListener((state) => {
      const on = Boolean(state.isConnected);
      setOnline(on);
      if (on && queuedCount()) void sync();
    });
    void (async () => {
      try {
        const session: SessionInfo = await agentApi.session();
        setWho(session.full_name || session.email);
        setWorkspace(session.workspace?.name ?? "");
        setCampaignParty(session.campaign_party || session.workspace?.party || "");
        if (session.parties?.featured?.length) setFeatured(session.parties.featured);
        if (session.parties?.other?.length) setOther(session.parties.other);
      } catch (e) {
        if (e instanceof AgentAuthError) {
          await signOut();
          onSignOut();
        }
      }
      try {
        const { units } = await agentApi.assigned();
        setAssigned(units);
        if (units[0]) setSelected(units[0]);
      } catch {
        /* offline: keep local selection */
      }
      void registerPushToken();
      refreshQueue();
    })();
    return () => {
      clearInterval(tick);
      stopNudges();
      sub();
    };
  }, [onSignOut, refreshQueue, sync]);

  async function pickPhoto(kind: "result_sheet" | "incident") {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== "granted") {
      Alert.alert("Camera needed", "Allow camera to photograph the sheet or incident.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.6, allowsEditing: false });
    if (result.canceled || !result.assets[0]) return;
    const durable = await persistQueueMedia(result.assets[0].uri, kind, "photo");
    if (kind === "result_sheet") setSheetUri(durable);
    else setIncidentUri(durable);
  }

  async function pickReportPhoto() {
    if (reportAttachments.length >= 3) return;
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== "granted") {
      Alert.alert("Camera needed", "Allow camera to attach a photo to your report.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.6, allowsEditing: false });
    if (result.canceled || !result.assets[0]) return;
    const durable = await persistQueueMedia(result.assets[0].uri, "report", "photo");
    setReportAttachments((prev) => [...prev, { uri: durable, mediaType: "photo" }]);
  }

  async function pickReportVideo() {
    if (reportAttachments.length >= 3) return;
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== "granted") {
      Alert.alert("Camera needed", "Allow camera to record a video for your report.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      videoMaxDuration: 45,
      quality: 0.5,
    });
    if (result.canceled || !result.assets[0]) return;
    const durable = await persistQueueMedia(result.assets[0].uri, "report", "video");
    setReportAttachments((prev) => [...prev, { uri: durable, mediaType: "video" }]);
  }

  async function submit(action: QueueAction, payload: Record<string, unknown>) {
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
      setLastSubmit(String(payload.captured_at));
      Alert.alert("Submitted", formatLagos(String(payload.captured_at)));
    } catch (e) {
      enqueue(action, payload);
      refreshQueue();
      Alert.alert("Saved offline", e instanceof Error ? e.message : "Will retry");
    } finally {
      setBusy(false);
    }
  }

  async function submitResults() {
    const party_votes = votesFromFields(votes, extras);
    const payload: Record<string, unknown> = {
      polling_unit_id: puId,
      party_votes,
      latitude: coords?.lat,
      longitude: coords?.lng,
    };
    if (sheetUri) {
      if (online) {
        setBusy(true);
        try {
          payload.result_sheet_url = (await agentApi.upload(sheetUri, "result_sheet", "photo")).url;
        } catch (e) {
          payload._localPhoto = sheetUri;
          payload._photoKind = "result_sheet";
          enqueue("results", { ...payload, captured_at: new Date().toISOString() });
          refreshQueue();
          setBusy(false);
          Alert.alert("Saved offline", e instanceof Error ? e.message : "Photo will upload when you reconnect");
          return;
        }
      } else {
        payload._localPhoto = sheetUri;
        payload._photoKind = "result_sheet";
      }
    }
    await submit("results", payload);
  }

  async function submitReport() {
    const payload: Record<string, unknown> = {
      polling_unit_id: puId,
      report_type: reportType,
      content: report,
    };
    if (reportAttachments.length) {
      if (online) {
        setBusy(true);
        try {
          const media_items = [];
          for (const item of reportAttachments) {
            const uploaded = await agentApi.upload(item.uri, "report", item.mediaType);
            media_items.push({ url: uploaded.url, media_type: uploaded.media_type });
          }
          payload.media_items = media_items;
        } catch (e) {
          payload._localMedia = reportAttachments.map((item) => ({
            uri: item.uri,
            kind: "report",
            mediaType: item.mediaType,
          }));
          enqueue("report", { ...payload, captured_at: new Date().toISOString() });
          refreshQueue();
          setBusy(false);
          Alert.alert("Saved offline", e instanceof Error ? e.message : "Media will upload when you reconnect");
          return;
        }
      } else {
        payload._localMedia = reportAttachments.map((item) => ({
          uri: item.uri,
          kind: "report",
          mediaType: item.mediaType,
        }));
      }
    }
    await submit("report", payload);
    setReport("");
    setReportAttachments([]);
  }

  async function submitIncident() {
    const payload: Record<string, unknown> = {
      polling_unit_id: puId || undefined,
      title,
      description,
      severity,
      is_emergency: emergency,
      latitude: coords?.lat,
      longitude: coords?.lng,
    };
    if (incidentUri) {
      if (online) {
        setBusy(true);
        try {
          const uploaded = await agentApi.upload(incidentUri, "incident", "photo");
          payload.media_url = uploaded.url;
          payload.media_type = uploaded.media_type;
        } catch (e) {
          payload._localPhoto = incidentUri;
          payload._photoKind = "incident";
          enqueue("incident", { ...payload, captured_at: new Date().toISOString() });
          refreshQueue();
          setBusy(false);
          Alert.alert("Saved offline", e instanceof Error ? e.message : "Photo will upload when you reconnect");
          return;
        }
      } else {
        payload._localPhoto = incidentUri;
        payload._photoKind = "incident";
      }
    }
    await submit("incident", payload);
  }

  return (
    <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Agent Portal</Text>
          <Text style={styles.muted}>
            {who || "Field reporting"}
            {workspace ? ` · ${workspace}` : ""}
          </Text>
          <Text style={styles.clock}>Submit time: {formatLagos(clock)}</Text>
        </View>
        <Pressable
          onPress={async () => {
            await signOut();
            onSignOut();
          }}
        >
          <Text style={styles.link}>Sign out</Text>
        </Pressable>
      </View>
      <QueueBar online={online} items={queueItems} syncing={busy} onSync={() => void sync()} />
      {lastSubmit ? <Text style={styles.muted}>Last submit: {formatLagos(lastSubmit)}</Text> : null}
      {tab !== "unit" && selected ? (
        <Pressable style={styles.selectedBar} onPress={() => setTab("unit")}>
          <Text style={styles.strong}>
            {selected.pu_code || selected.code} — {selected.name}
          </Text>
          <Text style={styles.link}>Change unit</Text>
        </Pressable>
      ) : null}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {tab === "unit" ? (
          <PuPicker
            assigned={assigned}
            selected={selected}
            onSelect={setSelected}
            coords={coords}
            onCoords={setCoords}
          />
        ) : null}
        {tab === "status" ? (
          <StatusForm
            status={status}
            turnout={turnout}
            disabled={busy || !puId}
            onStatus={setStatus}
            onTurnout={setTurnout}
            onSubmit={() =>
              void submit("status", {
                polling_unit_id: puId,
                status,
                turnout: Number(turnout) || 0,
              })
            }
          />
        ) : null}
        {tab === "report" ? (
          <ReportForm
            reportType={reportType}
            report={report}
            attachments={reportAttachments}
            disabled={busy || !puId}
            onType={setReportType}
            onReport={setReport}
            onPickPhoto={() => void pickReportPhoto()}
            onPickVideo={() => void pickReportVideo()}
            onRemoveAttachment={(index) =>
              setReportAttachments((prev) => prev.filter((_, i) => i !== index))
            }
            onSubmit={() => void submitReport()}
          />
        ) : null}
        {tab === "results" ? (
          <ResultsForm
            votes={votes}
            extras={extras}
            showOthers={showOthers}
            sheetUri={sheetUri}
            campaignParty={campaignParty}
            featured={featured}
            other={other}
            disabled={busy || !puId}
            onVote={(code, value) => setVotes((prev) => ({ ...prev, [code]: value }))}
            onExtras={setExtras}
            onToggleOthers={() => setShowOthers((v) => !v)}
            onPickPhoto={() => void pickPhoto("result_sheet")}
            onSubmit={() => void submitResults()}
          />
        ) : null}
        {tab === "incident" ? (
          <IncidentForm
            title={title}
            description={description}
            severity={severity}
            emergency={emergency}
            photoUri={incidentUri}
            disabled={busy}
            onTitle={setTitle}
            onDescription={setDescription}
            onSeverity={setSeverity}
            onEmergency={setEmergency}
            onPickPhoto={() => void pickPhoto("incident")}
            onSubmit={() => void submitIncident()}
          />
        ) : null}
        {busy ? <ActivityIndicator color="#93c5fd" /> : null}
      </ScrollView>

      <View style={styles.tabs}>
        {TABS.map((item) => (
          <Pressable key={item.id} style={[styles.tab, tab === item.id && styles.tabOn]} onPress={() => setTab(item.id)}>
            <Text style={tab === item.id ? styles.tabOnText : styles.tabText}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16, paddingTop: 8 },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 8 },
  title: { color: colors.text, fontSize: 22, fontWeight: "700" },
  muted: { color: colors.muted, fontSize: 13 },
  clock: { color: colors.muted, fontSize: 11, fontVariant: ["tabular-nums"] },
  strong: { color: "#e2e8f0", fontWeight: "600" },
  link: { color: "#93c5fd" },
  selectedBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    padding: 10,
    backgroundColor: colors.card,
    marginTop: 8,
  },
  scroll: { flex: 1 },
  content: { paddingVertical: 12, paddingBottom: 24, gap: 8 },
  tabs: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: 6,
    gap: 4,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 8 },
  tabOn: { backgroundColor: colors.primaryMuted },
  tabText: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  tabOnText: { color: colors.text, fontSize: 12, fontWeight: "700" },
});
