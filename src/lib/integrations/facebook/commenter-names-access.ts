export const COMMENTER_NAMES_FEATURE =
  "Business Asset User Profile Access";

export const COMMENTER_NAMES_FEATURE_URL =
  "https://developers.facebook.com/docs/features-reference/business-asset-user-profile-access/";

export const COMMENTER_NAMES_APP_REVIEW_URL =
  "https://developers.facebook.com/apps/";

/** Paste this into Meta App Review for Business Asset User Profile Access. */
export const COMMENTER_NAMES_REVIEW_USE_CASE = `We run a private campaign HQ inbox (Campaign Command Center) for the Facebook Page we manage. Staff reply to Page comments and need the commenter's name so we can address them personally and keep replies accountable.

We only request User fields name, id, and picture on people who commented on our Page. Names are shown only to signed-in campaign staff. We do not advertise with this data, sell it, or show it publicly.

Allowed usage: read User Fields (name, id, picture) for people engaging with our business asset (the Page) so HQ can reply in context.`;

export function hiddenCommenterSummary(hiddenCount: number) {
  const noun = hiddenCount === 1 ? "visitor name" : "visitor names";
  return `Facebook is hiding ${hiddenCount} ${noun}. Syncing again will not create them until Meta approves ${COMMENTER_NAMES_FEATURE} for the campaign Facebook app.`;
}
