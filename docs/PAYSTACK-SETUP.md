# Paystack donations

CCC has a public donate page at **`/donate`**. Supporters pay with Paystack; confirmed gifts are stored as CRM donations.

Share: `https://ccc-three-kappa.vercel.app/donate`

## 1. Paystack keys

1. Sign in at [dashboard.paystack.com](https://dashboard.paystack.com)
2. **Settings → API Keys & Webhooks**
3. Copy the **secret key** (`sk_test_…` for testing, `sk_live_…` for live)

## 2. Local

Add to `.env.local` (never commit):

```
PAYSTACK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

For a real redirect from Paystack, `NEXT_PUBLIC_APP_URL` must be a public HTTPS URL (use the Vercel URL, not localhost). Test keys still work against the live donate page.

```bash
npm run secrets:backup
```

Restart `npm run dev`.

## 3. Production (Vercel)

1. Open [Vercel env vars for CCC](https://vercel.com/kreation-vibe-studios-projects/ccc/settings/environment-variables)
2. Set `PAYSTACK_SECRET_KEY` for Production
3. Confirm `NEXT_PUBLIC_APP_URL=https://ccc-three-kappa.vercel.app`
4. Redeploy

## 4. Webhook

In Paystack → **Settings → API Keys & Webhooks**:

- Webhook URL: `https://ccc-three-kappa.vercel.app/api/donations/webhook`

The webhook HMAC uses the same secret key. Callback after checkout is `/donate/success` (also verifies the charge, so gifts still record if the webhook is delayed).

## 5. Database index (once)

In the [SQL Editor](https://supabase.com/dashboard/project/ffccfeodymiwwqshphmh/sql/new) run `supabase/migrations/20260820000002_donations_paystack.sql` so the same Paystack reference cannot be stored twice.

## 6. How it appears in CCC

- Donor is created or matched in **Campaign CRM** (email first, then phone)
- Amount is added to that contact and to the **Donations** dashboard total
- Admin → **Public donate page** has the copyable link

Test card (Paystack test mode): `4084084084084081`, any future expiry, any CVV.
