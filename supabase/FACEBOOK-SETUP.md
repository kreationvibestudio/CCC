# Fix Facebook Permission Error (#10)

If you see: **"requires pages_read_engagement permission"**

Your token needs to be regenerated with the correct permissions.

## Fix in 5 minutes

### 1. Open Graph API Explorer
https://developers.facebook.com/tools/explorer/

### 2. Select your app
Top dropdown → **campaign commander center** (or your app name)

### 3. Add permissions
Click **Add a Permission** and add ALL of these:
- `pages_show_list`
- `pages_read_engagement`
- `pages_read_user_content`

### 4. Generate token
- Click **Generate Access Token**
- Log in with the Facebook account that **manages** the page "Hon Akhakon Annenih"
- Click **Continue** and allow all permissions

### 5. Copy token to project
Open `m:\social media tracker\.env.local` and replace the line:

```
FACEBOOK_USER_ACCESS_TOKEN=paste_your_new_token_here
```

### 6. Restart the app
```bash
npm run dev
```

### 7. Sync again
Social Media → **Sync Facebook Now**

---

## Still not working?

- Make sure you're an **Admin** on the Facebook page
- In developers.facebook.com → your app → **Roles**, add your Facebook account as Administrator
- App must be in **Development** mode with you as a tester, OR approved for production

## Optional: use page token directly

After generating user token, visit this URL in browser (replace YOUR_TOKEN):

```
https://graph.facebook.com/v21.0/me/accounts?access_token=YOUR_TOKEN
```

Copy the `access_token` for page `671649942702174` and add to `.env.local`:

```
FACEBOOK_PAGE_ACCESS_TOKEN=paste_page_token_here
```

This skips token exchange and often works more reliably.
