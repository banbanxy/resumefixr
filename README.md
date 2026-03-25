# ResumeFixr

ATS Resume Optimizer — AI-powered resume rewrite suggestions to beat ATS filters and land more interviews.

## Tech Stack

- **Frontend**: Next.js 14 + Tailwind CSS
- **Deployment**: Cloudflare Pages + Workers
- **Database**: Cloudflare D1 (SQLite)
- **Payment**: PayPal Buy Now Button + IPN Webhook
- **AI**: 问问 API (Claude Sonnet, OpenAI-compatible)
- **Email**: Resend

## Project Structure

```
app/
  page.tsx                  # Home page (input form)
  result/[id]/page.tsx      # Free diagnosis + paywall
  success/[id]/page.tsx     # Full suggestions (post-payment)
  api/
    analyze/route.ts        # Free diagnosis API
    ipn/route.ts            # PayPal IPN webhook
    result/[id]/route.ts    # Fetch result API
lib/
  wenwen.ts                 # AI client
  resend.ts                 # Email helper
components/
  PaywallSection.tsx        # PayPal payment form
schema.sql                  # D1 database schema
wrangler.toml               # Cloudflare config
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
# Fill in your API keys
```

### 3. Create D1 database

```bash
npx wrangler d1 create resumefixr
# Copy the database_id into wrangler.toml

npx wrangler d1 execute resumefixr --file=./schema.sql
```

### 4. Deploy to Cloudflare Pages

```bash
npm run build
npx wrangler pages deploy .next --project-name=resumefixr
```

### 5. Configure Cloudflare Pages

In Cloudflare Dashboard → Pages → resumefixr → Settings:

- **Environment Variables**: Add all keys from `.env.example`
- **Functions → D1 Bindings**: Variable `DB` → database `resumefixr`

### 6. Configure PayPal IPN

PayPal → Account Settings → Notifications → Instant Payment Notifications:
- Enable IPN
- IPN URL: `https://your-domain.com/api/ipn`

## Development

```bash
npm run dev
```

## License

MIT
