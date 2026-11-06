# Restaurant Dashboard (MyPlanetServices)

Multi-tenant restaurant dashboard and kitchen display system built with Next.js App Router, Tailwind CSS, shadcn/ui, Supabase, and deployed to Cloudflare Workers via `@opennextjs/cloudflare`.

## Prerequisites

- Node.js (v20+ recommended)
- npm
- Supabase account & project

## 1. Installation

Clone the repository and install dependencies:

```bash
npm install
```

## 2. Environment Variables

Copy the example environment configuration to `.env.local`:

```bash
cp .env.local.example .env.local
```

Fill in your configuration values:

```env
# Supabase credentials (from Supabase Dashboard -> Project Settings -> API)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# App URLs
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_KITCHEN_URL=http://localhost:3000/kitchen

# n8n Webhook Integration
N8N_SHARED_SECRET=your-shared-secret
N8N_READY_WEBHOOK_URL=https://n8n.your-domain.com/webhook/order-ready
```

## 3. Development Server

Start the local Next.js development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

Available routes:
- `/` - Root portal
- `/login` - Magic link & dev login
- `/app` - Restaurant Owner & Manager area
- `/kitchen` - Kitchen Display System (dark mode)
- `/kitchen/pair` - Kitchen device pairing screen
- `/admin` - Platform Admin area

## 4. Build & Preview

Test the production Next.js build:

```bash
npm run build
```

Preview locally with Cloudflare Worker runtime (Wrangler):

```bash
npm run preview
```

## 5. Deployment

Deploy the application to Cloudflare Workers:

```bash
npm run deploy
```
