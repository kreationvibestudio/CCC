# Paystack donations

Supporters pay on the hosted Paystack page:

**https://paystack.shop/pay/816txayv39**

The campaign wrapper is **https://ccc-three-kappa.vercel.app/donate** (sends people to the same Paystack checkout). Copy either link from **Admin → Public donate page**.

Paystack collects name, email, phone, and amount. Receipts come from Paystack.

## Optional: record gifts in Campaign CRM

If you also set `PAYSTACK_SECRET_KEY` and the webhook URL, confirmed charges can be written into CRM automatically:

- Webhook: `https://ccc-three-kappa.vercel.app/api/donations/webhook`
- SQL once: `supabase/migrations/20260820000002_donations_paystack.sql`

Without that key, money still arrives in the Paystack/bank account; staff can log gifts manually on a CRM contact.

## Change the checkout URL

Set `NEXT_PUBLIC_PAYSTACK_PAYMENT_LINK` to another `https://paystack.shop/pay/…` page if you replace the Shop product. Redeploy after changing Vercel env.
