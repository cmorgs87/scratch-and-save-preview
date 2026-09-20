# Scratchoff Lite Backend Maintenance

## Normal startup

Run the backend with:

```powershell
cd backend
npm run dev
```

Normal startup does **not** run the historical lifetime-points backfill. It only loads required configuration and starts listening on the configured port.

Required environment variables:

- `PORT`
- `FRONTEND_URL`
- `JWT_SECRET`
- `DATABASE_URL`

These are currently provided through `backend/.env` for local development.

## Lifetime points historical backfill

Run the one-time or repeatable maintenance command with:

```powershell
cd backend
npm run backfill:lifetime-points
```

Use this command when:

- deploying the lifetime-points schema to an existing database;
- importing legacy users or ledger history;
- verifying historical lifetime totals after repair work.

Behavior:

- connects to the configured database;
- processes users in batches;
- derives lifetime totals from qualifying positive ledger rows;
- uses current `scratchCoin` only for the existing no-history fallback;
- never reduces an existing `lifetimePointsEarned` value;
- is safe to rerun;
- continues past invalid or failed user records when possible;
- exits nonzero if material failures occur.

Expected output:

- database connection start/connected/closed logs;
- historical backfill started/finished logs;
- final `processed`, `updated`, `unchanged`, `skipped`, and `failed` counts.

Failure behavior:

- one bad user record is logged and does not stop the full pass;
- if any material failures occur, the command exits nonzero;
- rerunning the command is safe because updates only apply when the recomputed lifetime total is greater than the stored total.

Rollback:

- the command does not mutate current `scratchCoin`;
- it only increases `lifetimePointsEarned` when a higher safe value is derived;
- if review is needed after a failed run, inspect the logged user IDs and rerun after correcting the underlying data.
