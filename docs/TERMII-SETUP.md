# Termii SMS setup

1. Sign up at [termii.com](https://termii.com)
2. Get API key from dashboard
3. Register a sender ID (e.g. `CCC` or campaign name)
4. Add to `.env.local` and Vercel:

```
TERMII_API_KEY=your_key
TERMII_SENDER_ID=CCC
```

5. Send test SMS via API:

```bash
curl -X POST http://localhost:3000/api/communications/send \
  -H "Content-Type: application/json" \
  -d '{"phone":"2348012345678","message":"Test from CCC"}'
```

Campaign batch send: POST with `{ "campaignId", "templateId", "ward", "supportLevel" }`.
