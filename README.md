# Dripdash AI Chat Prototype

WhatsApp-style AI booking assistant prototype for Dripdash IV clinic.

## Running locally

### Prerequisites
- Node.js 18+
- Convex account (free at convex.dev)
- Anthropic API key (added in Stage 2)

### Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Initialize Convex (run once):
   ```
   npx convex dev
   ```
   Log in and create a project. This writes `NEXT_PUBLIC_CONVEX_URL` to `.env.local`.

3. Copy `.env.local.example` to `.env.local` and fill in all values.

4. Start the dev server:
   ```
   npm run dev
   ```

5. Seed the database (first run only):
   ```
   curl http://localhost:3000/api/seed
   ```

Visit http://localhost:3000.

## Deploying to Vercel

1. Push to GitHub.
2. Import the repo in Vercel.
3. Add environment variables: `NEXT_PUBLIC_CONVEX_URL`, `ANTHROPIC_API_KEY`, `PROTOTYPE_PASSWORD`.
4. Deploy.

For Convex in production, run `npx convex deploy` to push schema and functions to the production deployment.

## Architecture

| Path | Purpose |
|------|---------|
| `convex/schema.ts` | All table definitions — ported to real platform later |
| `convex/seed.ts` | Sample nurses + customers |
| `convex/messages.ts` | Message storage and retrieval |
| `convex/claudeTools.ts` | Claude tool implementations (Stage 2+) |
| `convex/nurseSimulator.ts` | Simulated nurse reply scheduler (Stage 4+) |
| `app/api/chat/route.ts` | Streaming Claude endpoint (Stage 2+) |
| `components/ChatPage.tsx` | Main UI orchestrator |
| `components/NurseActivityPanel.tsx` | Activity feed (Stage 4+) |
| `components/InspectorPanel.tsx` | Claude reasoning panel (Stage 5+) |
