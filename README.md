# Scratchoff Lite

`scratchoff-lite` is a clean extraction of the scratch ticket portion of the main `scratch-coin-app` project.

It keeps:
- email signup/login with cookie sessions
- scratch coin balance and daily claim
- bronze, silver, and gold ticket configs
- a standalone scratch ticket UI backed by the extracted API

It intentionally drops:
- slots
- offers and redemption flows
- the broader game suite shell

## Structure

- `frontend/`: Next.js scratch-only client
- `backend/`: Express + Prisma scratch-only API

## Quick start

### Backend

1. Copy `backend/.env.example` to `backend/.env`
2. Install deps
3. Run `npm run prisma:generate`
4. Run `npm run prisma:push`
5. Run `npm run dev`

### Frontend

1. Copy `frontend/.env.example` to `frontend/.env.local`
2. Install deps
3. Run `npm run dev`

The frontend defaults to `http://localhost:3101` and the backend defaults to `http://localhost:4100`.

## Source mapping

This project was extracted from the original repo to preserve the scratch-ticket path while leaving the larger project intact for future work.
