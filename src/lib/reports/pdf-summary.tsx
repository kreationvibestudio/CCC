import { Document, Page, Text, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { getAnalyticsSummary } from "@/lib/analytics/data";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11 },
  title: { fontSize: 18, marginBottom: 12 },
  section: { fontSize: 13, marginTop: 14, marginBottom: 6 },
  row: { marginBottom: 6 },
});

type Summary = Awaited<ReturnType<typeof getAnalyticsSummary>>;

export async function buildSummaryPdf(summary: Summary) {
  const calls = summary.calls?.slice(0, 6) ?? [];
  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Campaign Command Center — Election Decision Summary</Text>
        <Text style={styles.row}>
          Days to election: {summary.daysToElection ?? "n/a"} · Sentiment score: {summary.kpis?.sentimentScore ?? 0}%
        </Text>
        <Text style={styles.row}>
          Pending comments: {summary.kpis?.pendingComments ?? 0} · Misinfo open: {summary.kpis?.misinfoOpen ?? 0}
        </Text>
        <Text style={styles.row}>
          PU agent coverage: {summary.kpis?.agentCoveragePct ?? 0}% · High-risk uncovered:{" "}
          {summary.kpis?.uncoveredHighRiskPus ?? 0}
        </Text>
        <Text style={styles.row}>
          Volunteers trained: {summary.kpis?.volunteersTrainedPct ?? 0}% · Undecided contacts:{" "}
          {summary.kpis?.undecidedContacts ?? 0}
        </Text>
        <Text style={styles.section}>Calls to make</Text>
        {calls.length ? (
          calls.map((c) => (
            <Text key={c.id} style={styles.row}>
              [{c.severity}] {c.title} — {c.action}
            </Text>
          ))
        ) : (
          <Text style={styles.row}>No decision calls generated.</Text>
        )}
        <Text style={styles.section}>Module counts</Text>
        <Text style={styles.row}>Volunteers: {summary.volunteers}</Text>
        <Text style={styles.row}>Contacts: {summary.contacts}</Text>
        <Text style={styles.row}>Events: {summary.events}</Text>
        <Text style={styles.row}>Comments: {summary.comments}</Text>
        <Text style={styles.row}>Polling Units: {summary.pollingUnits}</Text>
        <Text style={styles.row}>Incidents: {summary.incidents}</Text>
        <Text style={styles.row}>
          Sentiment — Positive: {summary.sentiment.positive}, Neutral: {summary.sentiment.neutral}, Negative:{" "}
          {summary.sentiment.negative}
        </Text>
        <Text style={{ marginTop: 20, fontSize: 9, color: "#666" }}>Generated {new Date().toLocaleString()}</Text>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}
