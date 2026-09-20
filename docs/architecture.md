# Architecture

Update this document whenever routing or launch architecture changes.

## Project Root

- `scratchoff-lite/`: live workspace root for the Scratchoff Lite project.
- `frontend/`: Next.js application and UI routes.
- `backend/`: Express API server for auth, rewards, ticket catalog, and game launch endpoints.

## Frontend Entry Points

- `frontend/app/layout.tsx`: root layout, global CSS, theme bootstrap, and auth gate mounting.
- `frontend/app/page.tsx`: initial app entry that routes signed-in users to `home` and guests to `login`.
- `frontend/app/home/page.tsx`: signed-in dashboard and primary navigation entry into tickets.
- `frontend/app/scratch/page.tsx`: main ticket browser, splash selection, launch orchestration, and active game surface.
- `frontend/app/login/page.tsx`: sign-in route.
- `frontend/app/signup/page.tsx`: account creation route.

## Routing Structure

- `/`: initial entry route.
- `/home`: signed-in dashboard route.
- `/login`: authentication route.
- `/signup`: account creation route.
- `/scratch`: ticket browsing and play route.

### Query-Driven Views

- `/home?tab=rewards`: rewards tab within the home route.
- `/scratch?view=tickets`: ticket browsing view.
- `/scratch?view=play`: active play view.
- `/scratch?theme=<themeId>`: selected game theme within the scratch route.

## Theme And Ticket Ownership

- `frontend/app/scratch/page.tsx`: source of the shared theme catalog and splash configuration map.
- `frontend/lib/battlescratch.ts`: Battlescratch game definitions and helpers.
- `frontend/lib/crossword/`: Crossword ticket definitions and helpers.
- `frontend/lib/reel-reveal/`: Reel Reveal ticket definitions and helpers.
- `frontend/lib/the-big-score/`: The Big Score ticket definitions and helpers.
- `frontend/lib/triple-crown-derby/`: Triple Crown Derby ticket definitions and helpers.
- `backend/src/server.ts`: ticket catalog source exposed to the frontend.

## Launch Architecture

- `frontend/app/home/page.tsx`: sends users into the scratch route.
- `frontend/app/scratch/page.tsx`: central launch coordinator for all themes.
- `frontend/app/scratch/_components/WebGameSplash.tsx`: shared desktop pre-game splash renderer.
- `frontend/app/_components/MobileGameFlowShell.tsx`: compact viewport pre-launch overlay.

### Launch Responsibility Split

- Desktop launch: shared splash flow rendered through `WebGameSplash`.
- Compact launch: overlay flow rendered through `MobileGameFlowShell`.
- Theme-specific play surfaces: mounted from `frontend/app/scratch/page.tsx` after launch.

## Backend Route Responsibilities

- `backend/src/server.ts`: health, auth, profile, rewards, ticket catalog, and game launch APIs.

### Launch-Related API Endpoints

- `GET /scratchers/tickets`: ticket catalog for the scratch route.
- `POST /scratchers/play`: shared play endpoint for classic scratch themes, Battlescratch, and Reel Reveal.
- `POST /crossword/start`: Crossword session start endpoint.
- `POST /crossword/claim`: Crossword reward claim endpoint.
- `POST /the-big-score/play`: The Big Score launch endpoint.
- `POST /triple-crown-derby/play`: Triple Crown Derby launch endpoint.

## Viewport Split

- `frontend/app/home/page.tsx`: determines compact vs desktop home layout.
- `frontend/app/scratch/page.tsx`: determines compact vs desktop scratch and launch layout.
- Compact/tablet-mobile behavior and desktop behavior are separated by a shared max-width `1279px` viewport breakpoint.
