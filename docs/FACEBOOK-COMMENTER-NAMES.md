# Unlock Facebook commenter names (Campaign Command Center)

CCC can sync Page comments today. **Visitor display names** only appear after Meta
grants Advanced Access to **Business Asset User Profile Access**. Syncing again
cannot invent names while that feature is blocked.

## What you are trying to fix

On Comments, people show as **Unknown commenter** even though the Facebook Page
UI shows their real name. That is Meta stripping the Graph `from.name` field.

Required path (order matters):

1. **Business verification** in Meta Business Suite (Security Center)
2. App **Live** + **App Review** Advanced Access for:
   - [Business Asset User Profile Access](https://developers.facebook.com/docs/features-reference/business-asset-user-profile-access/)
   - `pages_read_user_content`
   - `pages_read_engagement`
3. Back in CCC Comments → **Check again** (or Sync Facebook)

## Myth: “I need a government ID that shows my phone number”

**False.** Meta’s business-document help says uploads must prove the **legal
business name** and the business **mailing address or phone number**. Phone
confirmation is a separate OTP (SMS / call / WhatsApp) or you skip phone OTP
with **domain verification** / domain email.

Personal passport, NIN, or driver’s licence do **not** need a printed phone
line. Prefer **business** papers (CAC + bank/utility), not personal Meta Verified.

Official Meta help:

- [Which documents to upload](https://www.facebook.com/business/help/159334372093366)
- [How to verify your business](https://www.facebook.com/business/help/2058515294227817)
- [Security Center](https://business.facebook.com/settings/security)

## Nigeria document pack that usually works

Type every field in Business Settings **exactly** as on the papers
(spacing, Ltd / Limited, titles).

| Purpose | Document |
|---------|----------|
| Legal name | CAC Certificate of Incorporation **or** Business Name Registration |
| Address (or phone) | Business bank statement **or** utility bill (≈ last 3 months) showing the **same legal name + address** |
| Prove you control the contact | Domain verification on your HTTPS site, **or** email OTP on that domain, **or** SMS OTP to the business phone you entered |

Utility bills alone cannot invent a legal name — keep CAC as the name proof.

## Confirm connection without phone-on-paper

When Meta asks how to confirm the business:

1. Prefer **Verify domain** (meta tag or DNS TXT on the campaign website)
2. Or email OTP to `you@yourcampaigndomain.com` (not a random Gmail if Meta
   requires domain match)
3. Or SMS / voice / WhatsApp to the **business** number in Business Settings

That OTP **is** the phone proof. The CAC document does not have to list it.

## App Review (after Business verification shows Verified)

1. [developers.facebook.com/apps](https://developers.facebook.com/apps/) →
   **campaign commander center** → Live
2. App Review → Permissions and features → request Advanced Access for
   Business Asset User Profile Access (+ the `pages_*` permissions above)
3. Paste the use case from Comments (Copy App Review text)
4. Screencast: HQ login → Comments → Unknown commenter → explain staff need
   the name to reply personally → no public display / no ads resale
5. After approval: Comments → **Check again**

## While waiting

Use **Set name** on each Facebook comment if you can see the person on the
Page. CCC keeps staff-set names on the next sync.

## Still rejected?

- Wrong flow: personal **Meta Verified** / individual ID ≠ Business verification
- Name mismatch: Meta form ≠ CAC spelling
- Address mismatch: bill vs Business Settings
- Website not HTTPS or not loading
- App still in Development / feature still Standard Access

See also `FACEBOOK-SETUP.md` for page tokens and sync.
