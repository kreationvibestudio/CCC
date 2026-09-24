export const COMMENTER_NAMES_FEATURE =
  "Business Asset User Profile Access";

export const COMMENTER_NAMES_FEATURE_URL =
  "https://developers.facebook.com/docs/features-reference/business-asset-user-profile-access/";

export const COMMENTER_NAMES_APP_REVIEW_URL =
  "https://developers.facebook.com/apps/";

export const BUSINESS_VERIFICATION_URL =
  "https://business.facebook.com/settings/security";

export const BUSINESS_DOCUMENTS_HELP_URL =
  "https://www.facebook.com/business/help/159334372093366";

export const BUSINESS_VERIFY_HELP_URL =
  "https://www.facebook.com/business/help/2058515294227817";

/** Paste this into Meta App Review for Business Asset User Profile Access. */
export const COMMENTER_NAMES_REVIEW_USE_CASE = `We run a private campaign HQ inbox (Campaign Command Center) for the Facebook Page we manage. Staff reply to Page comments and need the commenter's name so we can address them personally and keep replies accountable.

We only request User fields name, id, and picture on people who commented on our Page. Names are shown only to signed-in campaign staff. We do not advertise with this data, sell it, or show it publicly.

Allowed usage: read User Fields (name, id, picture) for people engaging with our business asset (the Page) so HQ can reply in context.`;

/**
 * Meta does NOT require a government ID that shows a phone number.
 * Documents prove legal name + (address OR phone). Phone OTP / email / domain
 * confirm you control the number or website separately.
 */
export const BUSINESS_VERIFICATION_PLAYBOOK = `Unlock commenter names (Nigeria / campaign HQ)

Goal: Meta must return visitor names on Page comments. CCC cannot invent them.
You need two Meta approvals, in order:

1) Business verification (Business Manager → Security Center)
2) App Review → Advanced Access to “Business Asset User Profile Access”
   (plus pages_read_user_content and pages_read_engagement)

IMPORTANT — phone on a government ID is NOT required.
Meta’s own docs: upload documents that prove the legal business name and the
business mailing address OR phone number. Then confirm the phone/email/website
with OTP or domain verification. Personal passport/NIN do not need a phone line printed on them.

Document pack that works for Nigeria (match names character-for-character):

A. Legal name
   • CAC Certificate of Incorporation, or
   • CAC Business Name Registration / Certificate of Registration

B. Address (or phone) on a recent official paper (last 3 months preferred)
   • Business bank statement showing the same legal name + address, or
   • Utility bill (electricity, water, internet) in the business/campaign office
     name with the same address
   • If a bill shows the business phone, even better — but not required if
     address matches what you typed in Business Settings

C. Confirm connection without hunting for “phone on ID”
   Prefer one of these (Business verification step “confirm your connection”):
   • Domain verification on your HTTPS campaign website, or
   • Email OTP to an address on the same domain as the website
   • SMS / voice / WhatsApp OTP to the business phone you entered
     (the phone is verified live — the CAC paper does not need to list it)

Typing rules that cause most Nigerian failures:
   • Legal name in Meta = exact CAC name (spacing, Ltd, Limited, Hon. titles)
   • Address lines match the bank statement / utility bill
   • Website must load on HTTPS
   • Do not use a personal Gmail if Meta asks for domain-matching email —
     use name@yourcampaigndomain.com after DNS is set

After Business verification shows Verified:
   Developers → app “campaign commander center” → Live mode
   → App Review → request Advanced Access for Business Asset User Profile Access
   → paste the CCC App Review use case
   → screencast: sign in to CCC → Comments → show Unknown commenter → explain
     staff need the name to reply → after approval names appear

Until Meta approves, use Set name on Comments from what you see on the Page.`;

export function hiddenCommenterSummary(hiddenCount: number) {
  const noun = hiddenCount === 1 ? "visitor name" : "visitor names";
  return `Facebook is hiding ${hiddenCount} ${noun}. Syncing again will not create them until Meta verifies the business and approves ${COMMENTER_NAMES_FEATURE} for the campaign Facebook app.`;
}

export function businessVerificationPhoneMyth(): string {
  return "Meta does not need a government ID that prints your phone number. Prove the legal business name with CAC, prove address with a bank statement or utility bill, then confirm the phone or website with SMS/email/domain verification.";
}
