export const colors = {
  bg: "#0b1220",
  card: "#111827",
  border: "#1e293b",
  text: "#f8fafc",
  muted: "#94a3b8",
  primary: "#2563eb",
  primaryMuted: "#1e3a5f",
  danger: "#b91c1c",
  dangerText: "#f87171",
  onlineBg: "#14532d",
  onlineText: "#bbf7d0",
  offlineBg: "#713f12",
  offlineText: "#fde68a",
  selected: "#2563eb",
};

export const STATUS_OPTIONS = [
  { value: "not_active", label: "Not active" },
  { value: "voting_in_progress", label: "Voting in progress" },
  { value: "delayed", label: "Delayed" },
  { value: "minor_issue", label: "Minor issue" },
  { value: "serious_incident", label: "Serious incident" },
] as const;

export const REPORT_TYPES = [
  { value: "turnout", label: "Turnout update" },
  { value: "logistics", label: "Logistics" },
  { value: "observation", label: "Observation" },
] as const;

export const SEVERITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
] as const;
