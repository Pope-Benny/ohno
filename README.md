# Ohno · 大野

A tiny, no-frills kanban board for your homelab. Multiple boards, custom
columns, drag-and-drop cards, dark-by-default brutalist UI. Built with Vite +
React on the front and Express + SQLite (`better-sqlite3`) on the back, served
from a single container.

## Run it

```bash
docker compose up -d --build
```

- App + API: `http://localhost:3456`
- Data: named volume `ohno-data`, SQLite file at `/data/ohno.db`
- Port is bound to `127.0.0.1` only — put Caddy/Traefik/NPM in front if you
  want it reachable on your network. There is no built-in auth; guard it behind
  your reverse proxy's auth or keep it LAN-only.

First boot seeds a "Main Board" with To Do / In Progress / Done columns. Create
more boards with **+ Board**, rename a board by clicking its title.

## Reverse proxy examples

Caddy:

```caddyfile
boards.example.com {
    reverse_proxy 127.0.0.1:3456
}
```

Traefik (if the container is on the same network):

```yaml
services:
  ohno:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.ohno.rule=Host(`boards.example.com`)"
      - "traefik.http.services.ohno.loadbalancer.server.port=3000"
```

To change the published port or uncomment wider binds, edit the `ports`
section in `docker-compose.yml` (e.g. `8080:3000` to expose directly).

## Features

- Multiple boards; each with renamable, reorderable, addable/deletable columns
- Cards with title + description, created via inline quick-add
- Drag cards within and across columns; drag columns by their `::` handle
- Card detail modal with autosave (debounced)
- Confirm dialog on every delete
- Dark theme by default, light via the toggle (persisted)

## API

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| GET | `/api/boards` | | Nested boards → columns → cards |
| POST | `/api/boards` | `{name}` | |
| PATCH | `/api/boards/:id` | `{name}` | |
| DELETE | `/api/boards/:id` | | Cascades columns + cards |
| POST | `/api/boards/:id/columns` | `{name}` | |
| PATCH | `/api/boards/:id/columns/order` | `{columnIds: []}` | Full ordered list |
| PATCH | `/api/columns/:id` | `{name}` | |
| DELETE | `/api/columns/:id` | | Cascades cards |
| POST | `/api/columns/:id/cards` | `{title}` | |
| PATCH | `/api/cards/:id` | `{title?, description?}` | |
| DELETE | `/api/cards/:id` | | |
| PATCH | `/api/cards/:id/move` | `{toColumnId, index}` | Insert at `index` of target column |
| GET | `/api/health` | | Healthcheck |

## Local dev

```bash
# terminal 1 — API on :3001
cd server && npm install && npm run dev

# terminal 2 — Vite dev server + /api proxy
cd client && npm install && npm run dev
```

Then open `http://localhost:5173`. For a combined production-style run,
`npm run build` in `client/`, then `npm start` in `server/` (it serves the
built `client/dist` when present).

## Layout

```
client/   Vite + React + Tailwind v4 + dnd-kit + Motion
server/   Express + better-sqlite3 (REST API, static serving)
Dockerfile  multi-stage: client build → server deps → slim runtime
docker-compose.yml
```