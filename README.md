# LAST LIGHT

One lighthouse. One storm. Nobody has the whole picture.

Play: https://last-light-b62k.onrender.com

Build 0.4 adds a shared schematic sea chart and one route marker per keeper (Inspect, Looks safe, or Avoid). These are opinions, separate from the crew proposal. Markers survive refresh and reset for each ship. Use the Reduce motion control above the game; operating-system reduced-motion preferences are always respected. All actions work by keyboard, with a Skip to game link. No sound or voice is required.

The Free Render host can take about a minute to wake after inactivity. Rooms are in memory and end on server restart or deployment.

This prototype now builds a **complete cooperative watch** from the development plan: 2–4 browser players, optional practice, three puzzle families, private station clues, shared notes, proposals, unanimous confirmation, victory/defeat and replay. No player account or installation is required.

**Rules:** rescue three ships before the lighthouse takes three damage marks. Practice is optional and unscored. Every keeper gets their own station notes; share them, propose a route and beacon, and have everyone confirm the exact same proposal. Correct answers rescue a ship; incorrect answers add damage and divert the ship away. Review the explanation, then every keeper chooses Continue. A watch contains 3–5 scored ships. At the end, the host can replay in the same room. There is no timer.

Puzzle progression starts with **Safe Passage** (landmarks and hazards), then **Broken Compass** (explicit compass correction), then **Signal in the Fog** (two-symbol decoding). The server keeps the seed and solutions private and checks unique solutions and information distribution before sending each player their own clues.

Permanent hosting, a two-physical-device playtest, and the signed-in challenge walkthrough still need release work. Browser automation has covered the complete flows; no physical-device testing is claimed.

## Run

Requires Node.js 24 LTS and pnpm 11.25.0. In the project folder:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

If this computer has dependencies installed already, `./Start-LastLight.ps1` also launches the app directly through Node.

Open **http://localhost:3000**. The server prints a same-Wi-Fi address as well. A second device on that Wi-Fi must use the printed LAN address, **not localhost**. Windows Firewall must allow Node on the intended private network. For separate networks use an HTTPS host or the temporary public tunnel described below. Don't expose the development server publicly.

1. Player A enters a nickname and chooses **Light the beacon**.
2. Player B opens the site on another browser/device, chooses **Join a room**, and enters a nickname and Player A's code. An invitation link prefills the code.
3. Both players see the same crew list. Choose **I'm ready at my station** and check that both see **The crew is ready**.
4. The host leaves practice checked for a first playthrough, or unchecks it to skip practice, then chooses **Begin the watch**. Read your station notes and share clues in the crew notebook.
5. Anyone selects a route and beacon, then chooses **Propose answer**. Every keeper chooses **Confirm this proposal**. Editing a proposal resets all confirmations.
6. Review the outcome and explanation. Everyone chooses **Continue** when ready. Rescue three ships before three damage marks. The host can select **Play again** after the result or return the crew to the lobby.
7. Refresh one browser during an encounter: it should reclaim the same seat, notes, notebook, and proposal without adding another player.

## Check and build

```powershell
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm exec playwright install chromium
corepack pnpm test:e2e
corepack pnpm start
```

The production process serves the built React app and Socket.IO on one port. `PORT` defaults to 3000. Set `PUBLIC_ORIGIN` to the exact deployed HTTPS origin for an explicit allowlist (comma-separated origins are supported). Without an allowlist, production browser connections must match the request host. `/health` returns a small JSON health response. `.env.example` documents the variables; the app expects the host to provide them rather than loading a file automatically.

## Hosting

`render.yaml` is prepared for one Node web service on the Free compute plan. Push this repository to GitHub and create a Render Blueprint from it. The blank `PUBLIC_ORIGIN` uses the server's same-host browser restriction; after the service URL exists, it can be set to that exact HTTPS origin. Keep one instance: rooms are in memory, and a restart ends them. Free services can sleep after 15 minutes of inactivity and may take about a minute to wake. The public service address survives these sleeps, but existing rooms do not. No paid plan is authorized by this configuration.

For an initial public test, Cloudflare's official `cloudflared tunnel --url http://localhost:3000` can expose the **production** server at a temporary HTTPS URL without an account. That URL works only while this computer, the server and tunnel stay running. It is a development test URL, not the final judging host. Set `PUBLIC_ORIGIN` to the returned URL and restart the app before using it if origin restrictions are enabled.

`Start-LastLightDemo.ps1` starts the built server and an installed `cloudflared` in hidden background windows and prints their process IDs and URL-log location. It uses an IPv4 origin for the tunnel. It expects the verified binary at `tmp/cloudflared.exe`; on another machine, pass the installed binary’s path using `-CloudflaredPath`. Starting it creates a new temporary URL. Stop the printed server and tunnel process IDs when finished. This does not install a permanent service.

**Work-session limitation:** processes launched by the assistant can be terminated when a Work session ends, including processes launched through the background helper. A tool-runtime reset test does not prove they will survive session shutdown. Do not treat an assistant-launched `trycloudflare.com` link as a persistent hosted demo. For an immediate local test, run `./Start-LastLight.ps1 -Production` yourself in PowerShell and keep it running; then open `http://localhost:3000`. For a persistent public address, deploy the Render service instead.

## Multiplayer behavior

- The server owns membership, stations, readiness, clues, proposals, confirmations, and answer evaluation. Clients receive versioned **seat-specific** snapshots. The server never includes other keepers’ unshared clues or the solution before resolution. Public player lists never contain credentials.
- Two-player assignments split Chart Table + Signal Desk and Stormglass + Beacon Console; three/four-player assignments spread the same four stations across the crew. Explicit sharing publishes the exact authorized clue; submitted arbitrary clue text is never accepted.
- All three authored families use a deterministic seeded generator and a separate constraint checker. The checker enumerates route/signal pairs, requires one solution, and checks that omitting any station leaves ambiguity. Tests also check every 2/3/4-player information allocation. Generation retries are bounded and use a validated fallback seed. Recently used clue sets are avoided within a watch when alternatives exist. There is no live AI generation.
- Proposal revisions reject stale edits/confirmations. Every seated keeper confirms before one server-owned resolution. Replaying creates a fresh encounter ID; delayed intents for the previous ship are rejected.
- Practice has two routes and two signals and never alters rescue/damage counts. After each result, every seat must be ready to continue. The server updates scores exactly once, ends at three rescues or three damage, and rejects further encounter input after the finish. Replay returns to the lobby, preserves the code/crew, and clears scores and readiness.
- A disconnect freezes encounter decisions while preserving private notes for recovery. A permanent departure or expired reconnect seat returns everyone to the lobby rather than moving private clues to a new owner mid-puzzle. New people can only join in the lobby.
- Seat tokens have 256 bits of randomness, are hashed on the server and stored per tab in session storage. Invitation links contain only the room code. A reconnect explicitly proves seat ownership. Refresh works while the process is alive; it is unavailable if the browser disables session storage.
- A disconnected player's seat is reserved for 60 seconds; their status shows reconnecting. A live replacement connection with the same token takes over the old connection.
- The earliest connected remaining player becomes host when the host leaves or disconnects. Leaving frees a seat immediately. Crew changes clear readiness and recompute station previews.
- Empty abandoned rooms expire after 30 minutes. Connected lobbies do not expire just for being idle. Server restarts end all rooms and the client explains how to join/create again.
- Payloads are validated; capacity is enforced synchronously. Successful request IDs are deduplicated within a bounded per-connection cache. Client retries use the same ID. Network-loss recovery uses the stable seat instead of socket identity.
- Room creation and other operations have bounded per-IP limits. The service does not trust client-supplied forwarded-IP headers; a proxy may therefore share one budget across visitors. Tune trusted proxy attribution before larger public events.

## Structure

`src/client` contains React screens and original flat SVG art. `src/server` owns rooms, transport, and server-only puzzles. `src/shared/protocol.ts` contains public message types, with no authored answers. Integration tests connect real sockets and cover private serialization, clue ownership, revisions, outcomes, and reconnection. Browser tests use isolated contexts, including mobile layouts.

All illustration and CSS in this prototype were authored in this project with ChatGPT. No external art, web fonts, sound or paid asset service is used.
