# Project rules (always follow)

1. The source of truth is `IMPLEMENTATION_PLAN.md`. Do not change the tech stack, table names, column names, roles or routes in it.
2. Work on **one phase only**, exactly as the prompt describes. Do not start the next phase.
3. Do **not** add features, pages, libraries, files or settings that are not in the plan or the prompt. If something is missing or unclear, **stop and ask**.
4. Next.js App Router + TypeScript **strict**. No `any`. Use Server Components by default; use Client Components only for interactivity, realtime or browser APIs.
5. Never expose secrets in the browser. Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` may be public. `SUPABASE_SERVICE_ROLE_KEY` and other secrets are used only in server code (Server Actions, Route Handlers) and never imported by client components.
6. Every table has `restaurant_id` and **RLS enabled before use**. Every server action and route handler checks the user, the restaurant and the role before reading or writing.
7. Database changes only as SQL migration files in `supabase/migrations/` (timestamped). Never edit an applied migration; add a new one.
8. Money is stored in cents (integer) and shown as US dollars.
9. Use Tailwind + shadcn/ui components. Keep components small and reusable. Follow the design rules in the plan prompts.
10. Validate all form input with zod on the server.
11. Do not delete or rewrite working code from earlier phases unless the prompt says so.
12. At the end of every phase, report: files created/changed, commands to run, manual steps for the user (in plain English), and how to test the phase.
