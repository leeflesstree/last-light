# Development log

## October 26, 2026 — M1, first part: connected lobby

**Request:** follow the development plan and allow two people in separate browsers to create/join a room with a generated code.

Implemented React + TypeScript + Vite, Express + Socket.IO, runtime validation with Zod, and a single production service serving frontend and socket traffic on one port. All dependency versions are exact and recorded in `pnpm-lock.yaml`; pnpm is pinned to 11.25.0. Esbuild is the only dependency explicitly permitted to run its build script.

The responsive lobby has original flat coastal SVG artwork, generated six-character room codes, guest nicknames, invitations, a live 2–4-player crew list, station assignment previews, and shared readiness. The server enforces capacity, validates input, issues hashed seat credentials, deduplicates bounded request retries, restores a seat after refresh, replaces duplicate seat connections, reassigns host, and removes expired disconnected seats and abandoned rooms. Error messages cover invalid/missing/full rooms and unavailable credentials.

ChatGPT authored the source, illustration, styles, integration/browser tests, and run/deployment documentation. No third-party art or paid generation service was used. Source is in this project folder; no GitHub repository was created or pushed during this work.

### Verified

- TypeScript checks passed and production client/server builds passed.
- Seven integration tests passed using real Socket.IO connections: matching public snapshots/readiness, idempotent creation, concurrent final-seat joins, invalid input/forged credentials, refresh/connection replacement, host transfer on leave, and timed cleanup.
- Two local Playwright tests passed: two isolated browser contexts create/join by code, synchronize readiness, refresh without duplicate seats, and leave; invitation prefill, wrong-code recovery, and a 320-pixel mobile viewport with no horizontal overflow.
- The two-browser join/readiness/refresh/leave test passed through a temporary public HTTPS Cloudflare tunnel. This is independent browser-context coverage, not a claim that two physical devices or independent real networks were playtested.
- Production `/health` responded locally. The tunnel reported an HTTP/2 connection. Direct command-runtime fetches to its public hostname timed out, while Chromium's public end-to-end flow passed.
- The in-app browser handoff failed with a browser-session error; it was not used as evidence of successful rendering.

### Operational limits and next work

This is the lobby portion of M1, not a complete game. No private clues, answer submission, encounter resolution, tutorial, or session loop exist yet. Readiness reports the lobby connection check only. M1 remains open until the private-clue encounter and a two-real-device test succeed.

Rooms are held in one Node process and disappear on restart. Refresh recovery reserves a disconnected seat for 60 seconds while the process stays alive. The temporary HTTPS URL requires both this computer's server and its tunnel to stay running and has no uptime guarantee. `render.yaml` prepares a permanent single-instance deployment, but no paid plan or hosting account was configured.

The signed-in mission walkthrough is still unreviewed. No challenge submission has been made. Keyboard/touch semantic controls and reduced-motion styles are present; a full assistive-technology audit and physical-device test remain pending.

Next work packet at the end of this slice: one server-owned encounter, per-player private clues, one synchronized route/signal proposal, and server-controlled resolution. Implemented below.

## October 26, 2026 — Rough playable clues, build 0.2

Added one Safe Passage encounter with four station clues distributed across 2–4 keepers. Route layouts, hazard, request word, and beacon codebook vary between ships. A small server-only solver checks every route/signal pair for a unique answer. This authored family is a functional prototype; seed replay, other families, and full session progression remain future work.

Every acknowledgement and socket update now uses a seat-specific serializer. Each keeper receives only their own private clues; sharing an owned clue explicitly copies it into the public crew notebook. The solution stays on the server until the crew finishes the encounter. A guessed clue ID does not authorize access or sharing.

The host starts when every keeper is ready. Any keeper can propose a route and signal. Changing the proposal resets confirmations, stale revisions are rejected, and unanimous confirmation resolves exactly once. The debrief explains success or failure. The host can guide another ship or return to the lobby.

Refresh restores private notes, shared clues, proposals and the same encounter. Disconnected seats pause decisions for the existing grace period. Leaving or grace-period expiry returns the crew to the lobby; new people cannot join an active encounter. A new encounter ID prevents delayed input from changing the next ship.

Checks: TypeScript and the production build passed; all 12 integration/puzzle checks passed, including 500 generated examples, privacy for 2/3/4 players, forbidden sharing, proposal revisions, correct/incorrect outcomes, replay, and reconnect behavior. All three local browser tests passed. The new browser flow uses separate desktop and 390-pixel mobile contexts and covers private panels, clue sharing, refresh during play, confirmations resetting, rescue, replay, and return to lobby. Desktop/mobile captures were visually inspected. The complete new flow also passed through the existing public HTTPS tunnel after updating the service. This is automated browser-context coverage, not a physical-device playtest.

This is one playable encounter at a time. No tutorial, three-rescue/three-damage session, additional puzzle families, sound, or permanent host is claimed. The signed-in mission check and physical-device playtest remain pending.

## October 26, 2026 — Complete watch, build 0.3

Implemented the next M2/M3 work packet. A watch optionally begins with a playable, unscored two-route/two-signal practice encounter. The scored watch ends at three rescues or three damage marks and can last 3–5 ships. Every keeper confirms the same proposal and, after the explanation, explicitly signals readiness to continue. Only the server advances, scores, or finishes. The host can replay in the same room, clearing scores and readiness while preserving seats and room code.

Added Broken Compass (explicit heading offset and route headings) and Signal in the Fog (separate landmark and beacon symbol keys). All three families use deterministic seeded generation, a separate enumerating constraint checker, per-station ambiguity checks, bounded generation attempts and a validated fallback seed. Clue-set repetition is avoided within a watch where alternatives exist. Seeds, facts, authored answers, and history remain server-only; clients receive authorized station notes and public progress.

The tutorial explains sharing, proposing and confirming. Progress shows rescue/damage counts, numbered ships, no time limit, and clear final results. A practice mistake does not affect the watch. Unsupported tutorial route/signal selections are rejected on the server. Continue actions include the encounter ID and are idempotent per seat. Duplicate confirmations cannot score twice; delayed previous-ship actions cannot affect the next ship.

Validation: TypeScript passed. Automated coverage checks 1,500 family/seed combinations plus tutorial seeds for determinism, unique solutions, and information dependence across station/player allocations. Session tests cover 2/3/4-player victory, defeat, five-ship mixed outcomes, unscored practice, all-player continuation, late intents, and replay. The four local browser workflows passed, including full practice → victory → replay → defeat, a refresh during Broken Compass, and a 320-pixel phone viewport. Screenshots of desktop/mobile compass screens were visually inspected. The earlier demo processes were no longer running; the refreshed demo is launched with the documented background helper and checked separately over public HTTPS.

These are automated browser sessions, not physical-device or external-user playtests. Permanent hosting, signed-in challenge review, broader accessibility and presentation work, and external playtesting remain pending. No paid hosting, account creation, or challenge submission was performed.

Public verification: the complete practice → victory → replay → defeat browser workflow passed over the refreshed HTTPS tunnel. An initial request reached Cloudflare before the tunnel registered and returned Error 1033; the retry after registration passed. The background helper now explicitly tells the operator to wait for registration before opening its URL. The tunnel is temporary and its hostname changed; it is not a permanent release host.

## October 26, 2026 — Unreachable demo diagnosis

The user reported that the new public URL could not be reached. The local `/health` check returned connection refused, both recorded server/tunnel processes were gone, and no cloudflared process remained. The local background launch survived a JavaScript kernel reset during verification but did not survive Work-session shutdown. The earlier implication that this would stay available merely while the computer stayed on was incorrect.

Stopped treating temporary tunnel restarts as the permanent fix. Prepared the existing Render Blueprint with an explicit Free compute plan and a blank origin setting that uses the tested same-host restriction. Documentation now distinguishes manual local launch from assistant-managed ephemeral processes. Render is available but was not connected at diagnosis, so account connection is required before a hosted deployment can be completed. No paid service, repository, or live deployment was created in this repair step.

Render was subsequently added and its read-only connection succeeded. No workspace was selected; discovery returned one workspace named My Workspace. The local repository has no Git remote, and connected GitHub searches found no LAST LIGHT/game/challenge repository under the authenticated account. The Render deployment flow requires a pushed Git-provider repository. Hosted creation is waiting for the user's workspace selection and a Git repository URL. The current game build remains intact; no replacement live URL is claimed during this blocked setup step.


## October 26, 2026 - Persistent hosting

Published the existing game source to https://github.com/leeflesstree/last-light (main, initial commit ebbf7e9). Created a single Free Node web service in the confirmed Render workspace, My Workspace. The initial deploy became live and /health returned 200. All four hosted browser workflows passed, including full sessions. Public URL: https://last-light-b62k.onrender.com. The computer no longer hosts the public demo. Free service wake-up delays and in-memory room loss on restart remain documented limits.

## October 26, 2026 - M4 presentation and accessibility slice, build 0.4

Added original flat SVG sea-chart artwork alongside the private station notes. The chart shows public route labels, the current proposed route, attributed crew markers, and rescue/diversion feedback. It is explicitly schematic: no landmarks, headings, hidden clues, seed, or solution are added to the public view. Full text station clues and outcome explanations remain available.

Added server-owned route markers with fixed Inspect / Looks safe / Avoid intents. Each authenticated seat owns at most one marker and may replace or clear only that marker. Markers are public opinions and do not change proposal revisions or confirmations. They persist through seat recovery, reset for each new ship, reject invalid/unavailable routes, and use the same phase/disconnection/stale-encounter guards as other encounter actions. Arbitrary messages and spoofed author identities are not accepted.

Added a keyboard skip link, persistent per-browser reduced-motion preference (with storage failure fallback), system reduced-motion support, visible selected-marker states, text equivalents, polite marker announcements, and 44px marker controls. The game remains untimed and silent; voice and audio are not required. A brief harbour-light effect is disabled under reduced motion. Reviewed changed React components using the React best-practices skill: stable keys, top-level hooks, explicit control labels and pressed state, no new dependencies or global listeners, seat-specific server serialization retained.

Validation: TypeScript and client/server production builds pass; all 17 integration checks pass, including real-socket marker broadcasts, bounds, invalid intents/routes, unchanged confirmations, clearing, and new-encounter reset. Five local browser workflows pass. The new test uses actual Tab, Space and arrow keys for joining, sharing clues, marking routes, completing all three scored puzzle families, victory and replay. It also checks marker recovery after refresh, a 320px viewport, and animation suppression. Desktop/mobile chart screenshots were visually reviewed. This is automated browser coverage; external users, physical devices and assistive-technology testing remain pending. Hosted verification is recorded after deployment.
