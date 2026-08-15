<div align="center">

# ⚡ toprompt

**A pocket queue for your AI prompts.**

Ideas for prompts never arrive while you're at your desk. They show up in the shower, on the train, mid-walk — and they're gone by the time you open your editor. toprompt is the smallest possible fix: jot the prompt from your phone, copy it with one tap when you're back at the keyboard, check it off when it ships.

💭 idea &nbsp;→&nbsp; 📱 stash &nbsp;→&nbsp; 💻 copy &nbsp;→&nbsp; ✅ done

</div>

---

## Why

Prompt ideas are cheap to have and expensive to lose. Notes apps bury them, todo apps overcomplicate them, and "I'll remember it" never works. toprompt does exactly one thing: it's a per-project queue of prompts waiting to be run — nothing more.

- **Capture anywhere** — mobile-first UI, add a prompt in seconds
- **Organized by project** — each codebase gets its own queue
- **One-tap copy** — tap a prompt, it's on your clipboard, paste it into Claude Code / Cursor / whatever
- **Check off when done** — the queue only shows what's left
- **Your data, your server** — self-hosted, sign in with Google, done

## Stack

Boring on purpose. Small enough to read in one sitting.

| Layer | Choice |
|---|---|
| Framework | [TanStack Start](https://tanstack.com/start) (React 19, file-based routing, server functions) |
| Database | PostgreSQL + [Drizzle ORM](https://orm.drizzle.team) |
| Auth | [better-auth](https://better-auth.com) with Google sign-in |
| UI | Tailwind CSS v4 + [shadcn/ui](https://ui.shadcn.com) on Base UI |
| Server | [Nitro](https://nitro.build) — deploys anywhere Node runs |
| Runtime | [Bun](https://bun.sh) |

No client state library, no API layer, no tRPC. Server functions talk straight to the database; the router's loader cache is the only cache.

## Quickstart

You need [Bun](https://bun.sh), a Postgres database, and a [Google OAuth client](https://console.cloud.google.com/apis/credentials).

```bash
git clone https://github.com/t1dotdev/toprompt.git
cd toprompt
bun install

cp .env.example .env   # then fill it in (see below)

bun run db:push        # create tables
bun run dev            # http://localhost:3100
```

### Environment

| Variable | What it is |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth credentials — add `<your-url>/api/auth/callback/google` as an authorized redirect URI |
| `BETTER_AUTH_SECRET` | Any random string — `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | The URL the app is served from (e.g. `http://localhost:3100` in dev) |

## Deploy

The build output is a self-contained server:

```bash
bun run build
bun .output/server/index.mjs
```

Building with Bun produces a Bun-targeted server, so run it with Bun. Push `.output/` to any host (a VPS, Fly.io, Render, …) and run the command above. For platform presets — Vercel, Netlify, Cloudflare, Lambda — see the [Nitro deploy docs](https://v3.nitro.build/deploy).

### Docker / Dokploy

A multi-stage [`Dockerfile`](Dockerfile) is included — Bun builds, a slim Bun image serves on port `3000`.

```bash
docker build -t toprompt .
docker run -p 3000:3000 --env-file .env toprompt
```

On [Dokploy](https://dokploy.com): create an **Application** from this repo, set build type to **Dockerfile**, add the [environment variables](#environment), and point a domain at container port `3000`. Run `bun run db:push` against your database once to create the tables.

## Project layout

```
src/
├── db/schema.ts        # user/session (better-auth) + project/prompt tables
├── lib/
│   ├── auth.ts         # better-auth config
│   └── fns.ts          # every server function — the entire backend
├── routes/
│   ├── _authed/        # project list + prompt queue (auth-gated)
│   ├── login.tsx
│   └── api/auth/$.ts   # better-auth handler
└── components/ui/      # shadcn primitives
```

The whole backend is one file. If you want to know how toprompt works, read [`src/lib/fns.ts`](src/lib/fns.ts) — that's all of it.

## Contributing

Issues and PRs welcome. The bar for new features is deliberately high — toprompt stays small — but bug fixes, polish, and better mobile ergonomics are always fair game.

```bash
bun run dev              # dev server on :3100
bun run generate-routes  # regenerate the route tree after adding routes
bun run db:push          # sync schema changes
```

## License

[MIT](LICENSE)
