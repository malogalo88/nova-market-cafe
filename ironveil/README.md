# IRONVEIL

A browser-based multiplayer tactical FPS prototype. Original assets only — every texture, sound, and model is generated procedurally at load time.

## Quick Start

```
npm install
npm run build
npm start
```

Open http://localhost:8012, enter a name, and hit DEPLOY. You will join a 5v5 Deathmatch with 9 bots by default (Elimination is selectable in the play panel). Use a different port with `PORT=8013 npm start`.

To play over a LAN, friends can open `http://<your-ip>:8012` — the same server hosts both the client bundle and the WebSocket game service.

Mouse capture uses the browser Pointer Lock API: click anywhere on the game to capture, ESC to release (opens the pause menu), RESUME or another click to recapture.

## Controls (default, rebindable in Settings)

| Action | Key |
| --- | --- |
| Move / Jump / Crouch / Walk | WASD / Space / Ctrl / Shift |
| Fire / ADS | LMB / RMB |
| Reload | R |
| Weapon slots | 1 / 2 / 3 |
| Abilities | Q / E |
| Scoreboard / Chat / Quick chat | Tab / Enter / Z X |
| Perf overlay | F3 |

## Modes

- **Elimination** — round-based; freeze phase for loadout selection, first team to 5 rounds wins. No respawns within a round.
- **Deathmatch** — continuous respawns, first to 40 kills or highest score at 6:00.

## Operatives & Abilities

- **NYX** (Initiator) — Pulse Scan (reveal enemies 16m), Silent Step (quiet +15% speed)
- **KILN** (Sentinel) — Aegis Wall (destructible 250 HP barrier), Fortify (+50 armor)
- **ZEPHYR** (Duelist) — Slipstream (dash), Updraft (vertical launch)
- **LUMEN** (Support) — Solace Field (healing zone), Radiant Flare (blinds enemies looking at it)

## Arsenal

P9 Kestrel pistol, Hornet SMG, AR-77 Longhorn rifle, Mauler-12 shotgun, VKS Longshot sniper (scoped), Gorgon LMG, Tactical Blade. All weapons are data-driven: damage falloff, spread/bloom, recoil patterns, ADS times, and movement multipliers live in `shared/src/weapons.ts`.

## Architecture

```
shared/src/    Deterministic simulation + wire protocol
  config.ts      All tunables (tick rate, movement, abilities, quantization)
  weapons.ts     Data-driven weapon definitions
  agents.ts      Operative/ability definitions
  mapdata.ts     "Foundry" map geometry, spawns, nav nodes
  collision.ts   Uniform-grid AABB broadphase, raycast, dynamic boxes
  movement.ts    moveStep() — authoritative + client-predicted movement
  hitreg.ts      Head/body hitbox raycasts, spread-based bullet traces
  protocol.ts    Binary Writer/Reader
  netcodec.ts    Snapshot/event/roster encode-decode (quantized)

server/src/    Authoritative Node.js server (ws)
  Lobby.ts       HTTP static hosting, WS gateway, 64 Hz match stepper
  Match.ts       Phases, rounds, scoring, input application
  Combat.ts      Lag-compensated firing, damage, armor, reloads
  Abilities.ts   Server-authoritative ability effects
  Bots.ts        Difficulty-tiered bot AI with waypoint navigation
  LagComp.ts     Position history ring buffer for rewind
  anticheat.ts   Rate limiting, input/name/chat sanitization

client/src/    Three.js renderer + prediction
  net/NetClient.ts   Binary transport, snapshot buffer, interpolation
  game/Game.ts       Fixed-step prediction, reconciliation, camera, events
  render/*           Merged-geometry world, procedural atlas, characters,
                     viewmodel springs, pooled tracers/decals/sparks
  ui/HUD.ts          Diff-checked DOM HUD
  ui/Menus.ts        Menus, settings tabs, keybind capture, loadout select
  audio/AudioEngine.ts  Synthesized positional SFX (zero audio files)
  perf/PerfOverlay.ts   FPS graph + draw call/triangle counters
```

### Networking model

- Server ticks at **64 Hz**, broadcasts ~**21 snapshots/sec**, each ~19 bytes per entity (positions quantized to u16).
- Clients simulate locally via the same `moveStep()` the server runs, then reconcile against acknowledged inputs (`ackSeq`) — unacknowledged inputs are replayed on top of server state.
- Firing is lag-compensated: the server rewinds targets by `ping + 110 ms` using its position history before tracing bullets.
- Remote players are interpolated on a 110 ms delay buffer; extrapolation is clamped.

### Performance techniques

- One merged `BufferGeometry` per material for static world (single draw call per texture).
- Pooled tracer/spark/decal systems; instanced decals.
- Procedural 1024px canvas atlas replaces image assets entirely.
- HUD updates are diff-checked against last frame values.
- Audio is synthesized WebAudio — no downloads, voice-capped mixer.

## Development

```
npm run typecheck   # tsc --noEmit across shared/server/client/tests/tools
npm test            # unit tests: quantization roundtrip, snapshot codec,
                    # movement determinism, hitbox raycasts, world raycast,
                    # world winding, HUD ammo display
npm run smoke       # boots nothing itself; start server first, then:
                    #   node dist-server/smoke.js  (join/snapshot/roster/chat checks)
```

Project layout follows strict layering: shared imports nothing above it; the server never trusts client state beyond rate-checked input intents.
