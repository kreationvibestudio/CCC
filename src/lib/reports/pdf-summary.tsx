import { Document, Page, Text, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { getAnalyticsSummary } from "@/lib/analytics/data";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11 },
  title: { fontSize: 18, marginBottom: 12 },
  row: { marginBottom: 6 },
});

type Summary = Awaited<ReturnType<typeof getAnalyticsSummary>>;

export async function buildSummaryPdf(summary: Summary) {
  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Campaign Command Center — Summary Report</Text>
        <Text style={styles.row}>Volunteers: {summary.volunteers}</Text>
        <Text style={styles.row}>Contacts: {summary.contacts}</Text>
        <Text style={styles.row}>Events: {summary.events}</Text>
        <Text style={styles.row}>Comments: {summary.comments}</Text>
        <Text style={styles.row}>Polling Units: {summary.pollingUnits}</Text>
        <Text style={styles.row}>Incidents: {summary.incidents}</Text>
        <Text style={styles.row}>
          Sentiment — Positive: {summary.sentiment.positive}, Neutral: {summary.sentiment.neutral}, Negative: {summary.sentiment.negative}
        </Text>
        <Text style={{ marginTop: 20, fontSize: 9, color: "#666" }}>Generated {new Date().toLocaleString()}</Text>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}
