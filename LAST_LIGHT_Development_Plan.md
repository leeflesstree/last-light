# LAST LIGHT — Development Plan

Version 1.0 · Prepared October 25, 2026 · Target submission October 30, 2026, before 11:59 p.m. Pacific

Status: build 0.4 adds the M4 presentation/accessibility slice: original sea chart, synchronized crew route markers, persisted reduced-motion control, skip navigation, and a keyboard-only full-watch browser test. The core session and public Render hosting are implemented. Physical-device/external playtests, assistive-technology review, signed-in mission review, and final release assets remain open. See docs/DEVELOPMENT_LOG.md.

## 1. Product goal

Build a browser-based cooperative deduction game for 2–4 people. Each player operates lighthouse instruments containing different clues. Players communicate, choose a safe route and beacon signal, and guide ships through a storm.

**Pitch:** One lighthouse. One storm. Nobody has the whole picture.

The intended experience is a 10–15 minute session that produces shared discoveries and friendly disagreement. Players should understand how to participate within their first minute. A successful first encounter should make the cooperation mechanic obvious.

### Design pillars

1. Information creates cooperation: every station contributes a necessary clue.
2. Deliberate decisions: discussion and reasoning matter more than reaction speed.
3. Readable atmosphere: nautical artwork supports the puzzle without hiding its controls.
4. Reliable multiplayer: all players see the same public state, while private clues remain private.
5. Accessible participation: the full game works without dragging, rapid input, audio, or voice chat.

### Success measures

- Two people on separate devices can open the public URL, join a room, finish a session, and replay.
- First-time testers can explain the objective after the tutorial without developer coaching.
- At least three external playtest sessions complete without a blocking bug.
- Each puzzle has exactly one valid route-and-signal answer, verified by a solver.
- Refreshing a player page restores the correct seat and private clues while the room is still active.
- No solution fields or other players' private clues appear in that player's network payloads.

## 2. Challenge requirements and evidence

Sources: the official rules PDF supplied in this workspace and the public mission page listed in section 17. The signed-in mission walkthrough has not yet been inspected; checking it is a release prerequisite.

| Requirement | Planned implementation | Evidence before submission |
|---|---|---|
| Build with OpenAI through the mission | Use ChatGPT Work for design, code, debugging, and verification | Keep a short development log describing actual contributions |
| Public multiplayer game URL | One HTTPS service serving the app and multiplayer endpoint | Open from an independent device/network |
| Room-code entry | Create room, display six-character code, join by code | Complete a cross-device lobby test |
| No player login or installation | Nickname and guest seat session only | Test a fresh browser profile |
| Phone and laptop support | Responsive station panels and shared chart | Test touch and desktop layouts |
| Replayable | Randomized, solver-validated puzzle variants and replay in the same room | Complete two different sessions |
| Project title, cover, description, URL | Prepare all four submission assets | Final submission checklist |
| Judging: execution, creativity, value, polish at 25% each | Prioritize complete play, distributed deduction, social value, and refinement | Rubric review after external playtests |

**Deadline discrepancy:** the public page advertises October 31, while the supplied official rules specify October 30, 2026, at 11:59 p.m. PT. Use the earlier date for planning and confirm inside the mission. Target submission by 6 p.m. Pacific on October 30 to leave a buffer.

## 3. Scope and priorities

### P0 — required for the submission build

- 2–4 online players with room codes and guest nicknames.
- Lobby, station assignment, ready status, host start, and clear join errors.
- Four stations distributed among the available players.
- One tutorial encounter and three puzzle families.
- A shared chart, fixed candidate routes, and beacon-signal selection.
- Structured clue sharing and map pings; voice is optional and external.
- Confirmations tied to the current proposed answer.
- Server-controlled resolution, session outcome, and replay.
- Reconnection, host reassignment, and explicit room-expiration messages.
- Responsive layouts, keyboard controls, reduced motion, mute, and untimed play.
- Public deployment, complete device testing, and submission assets.

### P1 — add only after P0 passes

- Optional timed mode.
- Rotating stations between encounters.
- More puzzle variants and cosmetic ship diversity.
- A brief score breakdown and richer victory animation.

### Deferred beyond the challenge

Live AI puzzle generation, integrated voice/video, accounts, global matchmaking, leaderboards, persistent progression, public chat, 3D environments, physics-driven navigation, monetization, and multiple hosting regions.

**Scope rule:** if behind schedule, simplify art, animation, and content breadth first. Preserve online play, private clues, solvable puzzles, and a complete session.

## 4. Game rules

### Session structure

- The tutorial is optional and does not affect the session result.
- A session ends when the team rescues three ships or accumulates three failed encounters.
- Each encounter presents three routes and three beacon signals.
- Players must select the correct route and correct signal together.
- A correct pair rescues the ship. Any incorrect pair adds one lighthouse-damage mark; the fiction shows the ship diverting away rather than depicting casualties.
- Each completed encounter advances to a new puzzle. A session therefore contains 3–5 scored encounters.
- The final screen shows ships rescued, damage marks, and a replay button. Competitive scoring is deferred.

### Encounter flow

1. Reveal the ship and each station's private clues.
2. Players inspect panels, share selected clues, and ping the public chart.
3. Any player proposes a route and signal; the proposal is attributed publicly.
4. Every seated player confirms the exact current proposal.
5. Changing either selection clears all confirmations.
6. Once everyone has confirmed, the server locks inputs and resolves once.
7. The ship follows the selected route. Text explains the outcome and the relevant clues.
8. Everyone selects Continue; the server advances when all active seats are ready.

There are no movement controls. Routes are discrete choices, allowing deliberate, accessible play and reducing networking complexity.

### Player counts and station distribution

| Players | Station assignment |
|---|---|
| 2 | Player A: Chart + Signal Desk; Player B: Stormglass + Beacon Console |
| 3 | Player A: Chart; Player B: Stormglass; Player C: Signal Desk + Beacon Console |
| 4 | One station per player |

The lobby previews assignments. Two-station players switch tabs, with clear unread-clue indicators. Nobody receives another player's private clues automatically. Assignment stays fixed during a session in P0.

### Difficulty progression

- Tutorial: two routes, two signals, one explicit elimination clue, guided sharing.
- Early encounter: simple map and weather elimination.
- Middle encounter: add a ship-message decoding step.
- Later encounter: introduce a clearly signposted instrument rotation or reversal.
- Subsequent encounters after mistakes use new seeds at the current difficulty ceiling.

Untimed play is the default. If timed mode ships later, use a server-owned deadline and treat timeout as one failed encounter. Never make speed the only way to succeed.

## 5. Station and puzzle design

### Station responsibilities

| Station | Private information | Interaction |
|---|---|---|
| Chart Table | Route identifiers and their landmarks, order, or headings | Inspect route cards; share landmark facts |
| Stormglass | Which landmark or weather conditions are unsafe | Share hazard observations; mark a chart area |
| Signal Desk | Ship's encoded request or instrument orientation clue | Share message fragments and decoding evidence |
| Beacon Console | Codebook mapping symbols or requests to beacon signals | Share codebook entries; inspect signal options |

Public information includes the ship name, candidate route labels, current proposal, confirmations, rescue/damage count, shared clues, and connection status.

### Puzzle families

**A. Safe Passage:** eliminate routes using weather and landmark facts; decode a simple ship request into a beacon signal.

**B. Broken Compass:** use a stated compass offset or reversal to interpret the ship's requested heading; combine that with a hazard clue and signal codebook. Never ask players to discover an arbitrary, unhinted malfunction.

**C. Signal in the Fog:** decode a two-symbol request and cross-reference route characteristics. Each symbol has an explicit mapping; this is deduction, not external trivia or color recognition.

### Fully specified example

Public choices: routes A, B, C; signals Anchor, Bell, Star.

- Chart player: A passes the reef; B passes the buoy; C passes the reef and buoy.
- Stormglass player: reef routes are unsafe tonight.
- Signal Desk player: the ship requests the symbol decoded as TWO.
- Beacon player: ONE = Star; TWO = Bell; THREE = Anchor.
- Unique solution: route B + Bell.

Neither player in the two-person assignment can derive the complete answer alone. The clue-share buttons let the same puzzle be solved without speech.

### Generation pipeline

1. Choose a family, difficulty, and deterministic seed.
2. Construct one intended answer and route attributes.
3. Generate distractors and compatible clues from authored templates.
4. Enumerate all candidate route/signal pairs with an independent constraint checker.
5. Accept only if exactly one pair satisfies every clue and equals the intended answer.
6. Check information distribution: removing a station's clue set must leave multiple candidates for the relevant station dependency. Check this separately for each player-count assignment.
7. Reject repeated family/answer/landmark combinations within the current session when alternatives exist.
8. Retry generation up to a fixed bound; use a prevalidated fallback puzzle if needed.

The server retains the seed, answer, constraints, and clue allocation. Each client receives only its authorized view. Production bundles must not import the solution generator or fallback answer bank.

### Content targets

Prepare at least two authored parameter sets per family, three clear fallback puzzles, one tutorial, short success/failure explanations, and a compact symbol vocabulary. Randomization changes route layouts, names, mappings, and hazards while preserving understandable logic.

## 6. UX, visual design, and accessibility

### Screens

1. Home: title, one-sentence pitch, Create Room, Join Room, How to Play.
2. Lobby: room code, copy invitation link, player list, stations, readiness, and start.
3. Tutorial: a playable miniature encounter with progressive instructions.
4. Encounter: ship and shared chart, private instrument panel, shared clue log, proposal controls.
5. Resolution: selected route animation, outcome, clue explanation, Continue.
6. Session result: illuminated village or damaged lighthouse, outcome, replay, leave.

### Layout

Desktop uses a shared chart beside the private instrument panel. Mobile stacks a compact public status header, station tabs, instrument card, shared clues, and proposal controls. Keep primary actions reachable without horizontal scrolling. A join link prefills the room code but never contains a seat token.

### Art direction

Use navy backgrounds, warm amber highlights, cream text, brass outlines, and restrained teal accents. Sea charts and instrument illustrations are SVG. Keep interactable controls visually distinct from decorative instrument markings. The lighthouse beam and village lights provide the main reward animation.

Create a small asset list: logo/wordmark, lighthouse, chart frame, three ship silhouettes, landmark symbols, beacon symbols, weather icons, and cover composition. Prefer original vector art and CSS effects initially. Track source and license for any external asset.

### Accessibility acceptance criteria

- All actions work through keyboard and touch; dragging is never required.
- Touch targets aim for at least 44 × 44 CSS pixels.
- Information uses text or shapes in addition to color and sound.
- Every map route has a text equivalent describing its relevant landmarks.
- Focus indicators remain visible; dialogs restore focus to their trigger.
- Screen-reader announcements cover phase changes and results without reading every ping.
- Reduced-motion settings replace ship travel with a short fade or immediate result.
- Sound starts only after user interaction and can be muted independently.
- Text remains usable at 200% zoom; check a 320 CSS-pixel viewport.
- Clue sharing and confirmations have no rapid-input or precision requirements.

## 7. Proposed technical architecture

**Recommended stack:** React + TypeScript + Vite for the interface; Node.js + Express + Socket.IO for the multiplayer service; runtime validation such as Zod; Vitest for game logic; Playwright for multi-browser workflows.

These are implementation choices, not challenge requirements. Confirm supported package versions and deployment instructions during setup, then pin dependencies in a lockfile.

### Deployment shape

Use one Node service that serves the built frontend and Socket.IO endpoint on the same origin. A host supporting long-lived WebSocket connections, such as Render, is suitable. This avoids splitting browser hosting and the game server for the initial release.

- Browser sends intent; server validates and applies the action.
- Server is authoritative for rooms, phases, clues, answers, confirmations, and results.
- After accepted mutations, send a complete small per-player snapshot with a monotonically increasing room version.
- Client ignores older snapshots and replaces its state with newer authoritative snapshots.
- Render charts and ship travel with SVG/CSS; a game engine is unnecessary for this interface.

### Persistence decision

P0 uses one server instance with in-memory active rooms. It supports browser refresh and short network interruptions while the process remains alive. It does **not** promise recovery after a server restart. On restart, clients receive a clear room-ended message and can create a new room.

Do not deploy multiple instances without shared room storage and a compatible Socket.IO adapter. If restart survival becomes necessary, add a durable room snapshot store as a separate milestone. Do not add that complexity unless the hosting environment or mission requires it.

### Suggested structure

```text
src/
  client/
    screens/          Home, Lobby, Encounter, Result
    components/       Chart, StationPanel, ClueLog, Proposal, Status
    hooks/            connection and room subscription
    styles/           tokens, layout, motion
  server/
    rooms/            lifecycle, membership, host transfer
    game/             transitions, validation, outcome evaluation
    puzzles/          authored templates, generator, solver
    transport/        socket handlers and per-player views
  shared/
    protocol.ts       public request/response types
    schemas.ts        runtime schemas without secret content
tests/
  unit/
  integration/
  e2e/
public/assets/
docs/
```

## 8. Multiplayer contract and reliability

### Core state

| Entity | Fields |
|---|---|
| Room | internal ID, code, phase, version, host player ID, players, settings, expiry |
| Player | stable guest ID, hashed seat token, nickname, stations, ready/connected status |
| Session | seed, encounter index, rescued ships, damage, recent puzzle signatures |
| Encounter | puzzle ID, public chart, private clue allocation, answer, proposal revision, confirmations |
| Proposal | route ID, signal ID, proposing player, revision |
| PlayerView | public state, own stations/clues, permitted actions, server time |

Seat credentials and internal puzzle state never appear in the public player list.

### State machine

`LOBBY → TUTORIAL (optional) → DISCUSS → RESOLVING → DEBRIEF → DISCUSS or FINISHED`

Replay returns to the lobby, preserves the room code and present players, and resets the session. Only the server performs transitions. RESOLVING rejects proposals and confirmations so simultaneous inputs cannot apply the encounter twice.

### Client intents

| Intent | Required validation |
|---|---|
| createRoom / joinRoom | Valid bounded nickname, room capacity, joinable phase |
| setReady / startSession | Seat belongs to sender; host permission for start; 2–4 connected ready players |
| shareClue / pingChart | Clue belongs to sender; location is valid; rate limit |
| proposeAnswer | DISCUSS phase; route and signal exist; expected proposal revision matches |
| confirmProposal | Current proposal revision; active seat; complete route/signal selection |
| continueEncounter | DEBRIEF phase; active seat; idempotent readiness update |
| resumeSeat | Valid room and seat credential; room not expired |
| restartSession / leaveRoom | Correct phase and sender permission |

Mutation envelopes include a request ID, encounter ID when applicable, and expected proposal revision for answer edits. Acknowledgements return accepted/rejected status, a stable error code, and current version. Retries with the same request ID cannot double-apply an action.

### Disconnections and membership

- Never use an ephemeral socket ID as the persistent player identity.
- Issue a cryptographically random guest seat token; keep it in session storage and transmit through the authenticated socket handshake, never an invitation URL.
- A refresh reclaims the same seat. A second connection using the same token replaces the previous connection to avoid conflicting inputs.
- When a player disconnects, freeze puzzle mutations and display a reconnect state for up to 60 seconds. Existing clues remain visible to their owners.
- If the player resumes, send a complete authorized snapshot and resume the same encounter.
- If the grace period expires, return remaining players to the lobby with an explanation; do not silently redistribute private clues mid-puzzle.
- If the host departs, assign the earliest connected remaining player as host. Preserve the current encounter during the grace period.
- New players join only in the lobby; explain that an active game must finish or return to the lobby first.
- Delete abandoned rooms after an idle timeout, proposed at 30 minutes. Connected lobbies receive a warning before expiry; active sessions are not expired because nobody clicked recently.
- Reconnection features supplied by Socket.IO are an optimization. Always support explicit full-snapshot recovery.

### Security and operating limits

Generate unpredictable room codes from an unambiguous alphabet, detect collisions, and cap players at four. Validate every payload and authorization on the server. Render nicknames as text, limit their length, and reject control characters. Bound clue-log length, ping rate, room creation, and failed joins. Restrict origins in production. Never log seat credentials or private clue text. Validate room capacity on the server even during simultaneous joins.

## 9. Implementation backlog and completion gates

Effort estimates assume one developer working with ChatGPT, familiar web tools, and available hosting. Budget approximately 30–40 focused hours; estimates are not guarantees.

| Milestone | Estimate | Work | Completion gate |
|---|---:|---|---|
| M0: Requirements and setup | 2 h | Inspect signed-in mission, settle rules, scaffold repo, pin tools, confirm hosting | Mission requirements recorded; project runs locally |
| M1: Multiplayer vertical slice | 5 h | Create/join room, stable seats, public snapshots, one private clue each, one answer | Two real devices solve one encounter over public URL |
| M2: Puzzle engine | 5 h | Templates, independent solver, seed replay, privacy views, role allocation | All generated puzzles unique and solvable across 2/3/4-player assignments |
| M3: Complete session | 5 h | Tutorial, progression, proposal confirmation, win/loss, debrief, replay | Full victory and defeat paths work without manual resets |
| M4: Presentation and accessibility | 5 h | Responsive screens, chart art, structured sharing, focus, motion/audio controls | Phone and keyboard-only players complete a session |
| M5: Reliability and hardening | 4 h | Reconnect, host transfer, duplicate requests, input validation, room cleanup | Failure scenarios have no stuck phases or leaked secrets |
| M6: Playtest and submission | 4–6 h | External tests, targeted fixes, cover, description, final deployment | Release checklist passes and submission assets are ready |

Dependency order: M0 → M1 → M2/M3 → M4 → M5 → M6. Build an early public deployment during M1, not at the end. M2 and M3 can interleave, but polish follows a working session.

## 10. Calendar plan

All dates and times below are Pacific. The schedule assumes work begins October 26.

| Date | Main outcome | Exit criterion |
|---|---|---|
| Mon, Oct 26 | Requirements, scaffold, online vertical slice | Two independent devices join and solve one private-clue puzzle |
| Tue, Oct 27 | Puzzle engine and complete session | Tutorial, three families, victory/defeat, replay work |
| Wed, Oct 28 | Mobile interface, accessibility, atmospheric art | A new player can complete the tutorial on a phone |
| Thu, Oct 29 | Reliability and external playtests | Reconnect/privacy tests pass; blocking issues fixed |
| Fri, Oct 30 | Final checks, assets, submission | Submit by target 6 p.m.; official-rule cutoff is 11:59 p.m. |

### Contingencies

- If M1 misses Monday: reduce decorative work and use text-first station cards.
- If content is behind Tuesday: use smaller solver-validated authored parameter banks; keep all core session states.
- If mobile layout is unclear Wednesday: simplify charts to route cards with an optional visual map.
- After Thursday's tests: freeze features and fix only release-blocking or high-impact usability issues.
- If less than roughly 20 focused hours remain: prioritize two-player reliability, retain the 2–4-player design only where tested, and describe actual supported counts honestly in the submission.

Do not claim functionality that has not passed testing. Any scope reduction must still satisfy the signed-in mission requirements.

## 11. Testing plan

### Automated checks with meaningful coverage

**Puzzle unit tests:** enumerate all nine route/signal pairs; verify exactly one solution; generate a representative seed set across every family and player count; check that the intended answer matches the independent solver; verify each assignment requires another player's information; verify bounded fallback behavior.

**Game-transition tests:** test rescue/damage thresholds, one-time resolution, proposal changes invalidating confirmations, replay reset, wrong-phase rejection, and stale encounter inputs.

**Integration tests:** connect 2–4 socket clients; test simultaneous joins to the final seat, duplicate request IDs, unauthorized clue sharing, invalid resume credentials, player-specific snapshots, host loss, and expired rooms.

**Browser tests:** separate browser contexts create/join a room, complete the tutorial, win, lose, replay, refresh one player, and verify all views converge. Use a real deployed smoke test in addition to local automation.

### Manual matrix

| Scenario | Expected result |
|---|---|
| Phone + laptop on separate networks | Same public state; correct private panels |
| Two, three, and four players | All four stations assigned; no unowned critical clue |
| Wrong/full/expired room code | Specific error and usable recovery action |
| Phone locks or network drops | Reconnect message; no silent loss of seat |
| Host closes tab | Grace period and clear host reassignment |
| Players propose simultaneously | One accepted revision; others resynchronize |
| Proposal edited after confirmations | All confirmations reset |
| Repeated confirm clicks | One resolution and one encounter outcome |
| Someone leaves permanently | Clear return to lobby after grace period |
| Server restarts | Explicit room-ended message and Create Room action |
| Keyboard, touch, zoom, reduced motion | Full session remains playable |
| No voice and no sound | Structured clues are sufficient to solve |

### External playtest protocol

Ask testers to join from the URL with minimal explanation. Observe where they hesitate, what they incorrectly assume is interactive, whether each player contributes, and whether the debrief makes mistakes understandable. Record device, player count, tutorial completion, session outcome, blocking bugs, and one desired change.

Run at least one two-player session and one larger group. Reserve a final session to validate the fixes. Treat these as usability observations, not statistically reliable satisfaction measurements.

## 12. Deployment and release operations

1. Create build, start, typecheck, and test commands; commit the lockfile.
2. Bind the service to the host-provided port and serve frontend assets plus the socket endpoint.
3. Add a simple health endpoint and bounded room cleanup.
4. Configure production origin and environment settings outside source control.
5. Deploy one instance and verify HTTPS, socket connection, and invitation links.
6. Check current hosting cold-start, idle, restart, and capacity behavior before selecting the plan. Do not assume free hosting provides an always-on game server.
7. Run the cross-device smoke test and reconnect test on the actual URL.
8. Tag or otherwise record the tested release and retain the previous working deploy for rollback.
9. Stop routine deployments during external playtests and judging access windows because in-memory rooms reset on restart.

Proposed demo capacity target: five simultaneous four-player rooms in a controlled smoke/load exercise. This is a test target, not a production capacity claim. Observe memory, reconnect rates, and rejected/accepted actions; increase only if measured behavior supports it.

## 13. Risks and responses

| Risk | Early signal | Response |
|---|---|---|
| Players do not need each other | One person solves everything | Audit clue distribution and test partial-information candidates |
| Puzzles feel arbitrary | Players guess without explaining clues | Simplify transformations; show explicit mappings and useful debriefs |
| State becomes inconsistent | Different proposals or results across screens | Server authority, revisions, idempotency, full snapshots |
| Hidden information leaks | Other clues or answer visible in payloads | Dedicated server-only puzzle modules and per-player serializers |
| Scope exceeds time | Core session incomplete by Tuesday | Cut decoration and variant count; preserve full play loop |
| Mobile station overload | Frequent scrolling and missed clues | Short cards, clear tabs, compact public status |
| Disconnect blocks progress | Missing confirmation never resolves | Grace period, clear status, return-to-lobby policy |
| Hosting restarts erase rooms | Unexpected missing-room errors | Honest recovery UI, stable single service, avoid deploys during play |
| Guide has extra requirements | Signed-in instructions differ | Inspect before implementation and update acceptance criteria |

## 14. Definition of done

### Release blockers

- [ ] Signed-in mission guide reviewed and requirements reconciled.
- [ ] Public URL works for a fresh visitor without login or installation.
- [ ] 2–4 players can join by code and receive correct stations.
- [ ] Tutorial, win, loss, debrief, and replay flows complete.
- [ ] Puzzles have unique solutions and distributed information.
- [ ] No private-clue or solution leakage in client bundles/payloads.
- [ ] Concurrent inputs and retries cannot duplicate a result.
- [ ] Refresh, temporary disconnect, host departure, and room expiry are handled.
- [ ] Mobile, keyboard, no-voice, mute, and reduced-motion play verified.
- [ ] Automated checks and deployed device smoke test pass.
- [ ] No known issue prevents joining, solving, finishing, or replaying.

### Submission package

- [ ] Final title: LAST LIGHT.
- [ ] Cover image made from the final game's visual identity and readable at thumbnail size.
- [ ] Concise description accurately reflects tested functionality.
- [ ] Public game URL opens and allows a group to play.
- [ ] Development log accurately records ChatGPT's contribution.
- [ ] Asset provenance and any required credits included.
- [ ] Submission entered through the Handshake mission before the earlier official deadline.
- [ ] Confirmation retained after the user submits; no automated mass entry.

Suggested cover: a warm lighthouse beam crossing a navy sea, three small ships, four instrument symbols, and a prominent LAST LIGHT wordmark. Capture actual game visuals after the interface stabilizes.

## 15. Suggested implementation work packets

Each packet should end with a runnable result and a short record of what changed, what was verified, and any remaining limitations.

1. **Walking skeleton:** app, server, room creation/join, one secret clue, one synchronized choice, public deployment.
2. **Deduction core:** server-only templates, independent solver, role views, exact answer evaluation.
3. **Full session:** proposal revisions, unanimous confirmation, rescue/damage, debrief, tutorial, replay.
4. **Playable interface:** chart and station cards, structured clue sharing, responsive layout, accessibility.
5. **Resilience:** seat recovery, host transfer, validation, cleanup, concurrent-action tests.
6. **Release:** external playtests, targeted fixes, final cover/description, deployed verification.

Start implementation with packet 1. Avoid generating all screens and features in one unverified pass.

## 16. Decisions to revisit after the first playable build

- Is the 10–15 minute session target realistic for new groups?
- Does every player have something useful to contribute in each encounter?
- Does the compass transformation create satisfying deduction or unnecessary confusion?
- Are structured clue buttons sufficient for remote players without voice?
- Is three rescues/three damage the right session length?
- Does the chosen host need restart-persistent storage for reliable judging access?

Use observed play to answer these questions. Preserve the small core unless a change materially improves understanding or reliability.

## 17. Sources and verification notes

- Supplied official rules: `[AI_Skills_Studio_Challenge]_Contest_Official_Rules.pdf` in the project workspace. Read for entry assets, submission method, deadline, and four equally weighted judging criteria.
- Handshake public mission: https://joinhandshake.com/learn/create-a-multiplayer-game-8d7d59b5/ — public URL, room code, no login/install, phone/laptop, replayable game expectations. Accessed during planning; the signed-in walkthrough remains to be checked.
- Socket.IO architecture: https://socket.io/docs/v4/how-it-works/ — bidirectional communication and room broadcasting.
- Socket.IO guest identity caveat: https://socket.io/docs/v4/server-socket-instance/ — socket IDs are ephemeral; use application-owned seat identity.
- Socket.IO rooms: https://socket.io/docs/v4/rooms/ — multi-instance rooms require additional coordination.
- Render WebSockets: https://render.com/docs/websocket — web services accept WebSocket connections.
- Render web services: https://render.com/docs/web-services — service hosting and public HTTPS address.

Technology selections, estimates, UX targets, and game mechanics are proposed design decisions. They are not statements of contest requirements or guarantees about hosting performance.
