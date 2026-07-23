# Pixel Wall

A live collaborative pixel canvas for a portfolio — visitors click a cell, pick a color, and everyone connected sees it update in real time. Think r/place, scoped to a 50×50 board you own.

## Stack

| Layer | Choice |
| --- | --- |
| Frontend | React + TypeScript + Vite + HTML canvas |
| Backend | Node + Express + TypeScript + Socket.IO |
| Database | MongoDB (native driver) |

## Schema

**`pixels`** — one document per cell (easy to reason about; natural for constant single-cell upserts):

```js
{
  _id: "12_34",           // "x_y" unique key
  x: 12,
  y: 34,
  color: "#ff6b35",
  updatedBy: "anon-8f3a1",
  updatedAt: ISODate("...")
}
```

Board is pre-seeded at startup (50×50 = 2500 white pixels) if empty.

**`paintLog`** — append-only history (powers time-lapse replay + “pixels painted today”):

```js
{
  x: 12,
  y: 34,
  color: "#ff6b35",
  updatedBy: "anon-8f3a1",
  timestamp: ISODate("...")
}
```

Indexed on `timestamp`.

### Why one doc per pixel (not one doc for the whole board)?

- **Per-pixel docs**: simple `updateOne` by `_id`, no document contention when many people paint different cells, and the board stays under Atlas free-tier size easily at 50×50. Reads on connect are one `find({})`.
- **Single board doc**: fewer documents and one atomic snapshot, but every paint rewrites a large array (write amplification + last-write-wins races across cells). Fine for tiny demos; worse under concurrent painters.

## Event flow (Socket.IO)

1. **Connect** → server queries `pixels` and emits `board`.
2. **Client** emits `paint` `{ x, y, color }`.
3. **Server** validates bounds (0–49), hex color, and a **10s per-visitor cooldown** (in-memory `Map`).
4. Upsert `pixels`, insert `paintLog`, broadcast `pixelUpdated` to everyone (including sender).
5. Clients repaint only that cell.

REST:

- `GET /replay` — paint log sorted by timestamp
- `GET /stats` — count of paintLog docs in the last 24 hours
- `GET /health` — liveness

## Local development

### Prerequisites

- Node 20+
- MongoDB (local) **or** [MongoDB Atlas](https://www.mongodb.com/atlas) free M0 cluster

### Setup

```bash
cp .env.example server/.env
# edit MONGODB_URI

npm install
npm install --prefix server
npm install --prefix client

npm run dev
```

- Client: http://localhost:5173  
- Server: http://localhost:3001  

Vite proxies `/stats`, `/replay`, `/health`, and `/socket.io` to the API in dev.

### Seed

Seeding runs automatically on server start. To run manually:

```bash
npm run seed --prefix server
```

## Features for the portfolio demo

- Live multi-visitor painting via Socket.IO
- Color palette + HTML canvas grid
- 10-second cooldown with on-screen timer
- “X pixels painted today” from Mongo
- **Replay** — blank board, animate history at 20 pixels / animation frame
- **“Waking up the server…”** banner for free-tier cold starts

## Deploy (cheap & legit)

1. **MongoDB Atlas** (M0 free) — create a cluster, DB user, allow network access, copy URI into `MONGODB_URI`.
2. **Backend** — Render / Railway / Fly.io (needs a long-lived process for WebSockets). Set:
   - `MONGODB_URI`
   - `CLIENT_ORIGIN` = your frontend URL
   - `PORT` (platform usually sets this)
3. **Frontend** — Vercel / Netlify. Set:
   - `VITE_API_URL` = `https://your-api.example.com`
   - `VITE_SOCKET_URL` = same origin as the API (or omit if identical)
4. Optional: custom domain on the frontend so the link isn’t `*.onrender.com`.

## Project layout

```
pixel-wall/
  client/          React + Vite
  server/          Express + Socket.IO + Mongo
  .env.example
  README.md
```

## License

MIT — use it on your portfolio freely.
