# PC Builder Pro — Vercel Ready
Deploy steps:
1) `npm install`
2) `npm run build`
3) Deploy via **Vercel Dashboard** (import repo) or **Vercel CLI**:
   - `vercel` (first deploy)
   - `vercel --prod` (production)

Important files:
- `vercel.json` (SPA rewrite)
- `vite.config.ts` (alias @ -> src)
