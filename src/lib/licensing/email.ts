import { sendTermiiEmailTemplate, termiiEmailConfigured } from "@/lib/integrations/termii/client";
import { appBaseUrl } from "@/lib/campaign";

export async function sendLicenseCopyEmail(input: {
  to: string;
  name: string;
  licenseKey: string;
  expiresAt: string | null;
}): Promise<{ sent: boolean; skipped?: boolean; error?: string }> {
  if (!termiiEmailConfigured()) {
    return { sent: false, skipped: true };
  }
  const base = appBaseUrl();
  const expiresLabel = input.expiresAt
    ? new Date(input.expiresAt).toLocaleDateString("en-NG", {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "Africa/Lagos",
      })
    : "see Admin";
  // Termii email template variables: name / code / url
  const result = await sendTermiiEmailTemplate({
    to: input.to.trim().toLowerCase(),
    name: `${input.name} (license to ${expiresLabel})`,
    code: input.licenseKey,
    url: base ? `${base}/admin` : "https://ccc-three-kappa.vercel.app/admin",
  });
  if (!result.ok) return { sent: false, error: result.error };
  return { sent: true };
}
