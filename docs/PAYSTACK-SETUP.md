# Paystack donations

Supporters pay on the hosted Paystack page:

**https://paystack.shop/pay/816txayv39**

The campaign wrapper is **https://ccc-three-kappa.vercel.app/donate** (sends people to the same Paystack checkout). Copy either link from **Admin → Public donate page** or **Donations**.

Paystack collects name, email, phone, and amount. Receipts come from Paystack.

## Record gifts in HQ Donations

1. In Vercel → CCC → Settings → Environment Variables, set **Production** `PAYSTACK_SECRET_KEY` to the live secret (never commit it). Redeploy.
2. In Paystack Dashboard → Settings → API Keys & Webhooks, set the **Live Webhook URL** to one of:

   - `https://ccc-three-kappa.vercel.app/api/donations/webhook`
   - `https://ccc-three-kappa.vercel.app/api/paystack/webhook` (same handler)

   Do **not** leave the webhook on the old Render fundraising app (`fund-raising-platform-bxhe.onrender.com`). Paystack sends each charge to a single URL; HQ only sees gifts that hit CCC.

Without that key, money still arrives in the Paystack/bank account; staff can log gifts manually on **Donations**.

## Change the checkout URL

Set `NEXT_PUBLIC_PAYSTACK_PAYMENT_LINK` to another `https://paystack.shop/pay/…` page if you replace the Shop product. Redeploy after changing Vercel env.
