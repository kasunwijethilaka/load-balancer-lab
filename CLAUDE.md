# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this project is

A hands-on learning lab comparing three load balancing approaches side by side, all
proxying the same three backend servers:

1. **`custom-lb/`** — a hand-rolled Node.js load balancer (round robin + least-connections,
   active health checks), written from scratch on purpose — the point is to understand the
   mechanics, not to use a library.
2. **`nginx/`** — nginx config doing the same job, for comparison (passive health checks only
   in open-source nginx).
3. **`haproxy/`** — HAProxy config doing the same job (active health checks + live stats
   dashboard).

This is a **learning project**, not a production system. Prioritize clarity and
"can I explain what this line does" over cleverness or premature abstraction.

## Repo structure

```
backend/        # Dummy backend server (Node, no dependencies) — identifies itself,
                 # has /health and /toggle-health endpoints for simulating failure
custom-lb/       # Hand-rolled load balancer — the core learning artifact
nginx/           # nginx.conf
haproxy/         # haproxy.cfg
docker-compose.yml
```

Each service resolves the others by Docker Compose service name (`backend1`, `backend2`,
`backend3`) via Docker's internal DNS — not hardcoded IPs.

## Commands

```bash
docker compose up --build      # start everything
docker compose logs -f custom-lb   # watch the hand-rolled LB's health-check logs
docker compose exec backend2 wget -qO- localhost:3000/toggle-health   # simulate a backend dying
```

No test runner is set up yet. If adding tests, prioritize unit-testing the load-balancing
algorithm functions in `custom-lb/lb.js` (`pickBackendRoundRobin`,
`pickBackendLeastConnections`) in isolation from the actual networking/proxying code —
that split already exists in the file on purpose.

## Conventions & constraints

- **Plain Node.js only in `backend/` and `custom-lb/` — no npm dependencies.** This is
  deliberate: the point of `custom-lb/lb.js` is to see the proxying and health-check logic
  directly using the built-in `http` module, not behind an abstraction like `http-proxy`.
  Don't introduce a package.json unless explicitly asked to.
- Keep `custom-lb/lb.js` as a single file unless it grows enough to genuinely need splitting
  — this is meant to stay readable top to bottom in one sitting.
- When adding a new load-balancing algorithm, follow the existing pattern: a pure function
  that takes the `backends` array and returns one backend (see `pickBackendRoundRobin` /
  `pickBackendLeastConnections`), selected via the `ALGORITHM` env var — don't hardcode a
  choice into the request handler.
- nginx and HAProxy configs should stay functionally in sync with `custom-lb/lb.js` — if a
  new algorithm or health-check behavior is added to one, note in the README whether/how the
  other two can replicate it (or explicitly can't, e.g. nginx's lack of active health checks
  in the open-source version — that gap is itself part of the lesson).
- README changes matter as much as code changes here — this repo's purpose is partly to be
  read, not just run. Keep the "what each one demonstrates" section accurate as things change.

## What NOT to do

- Don't add authentication, TLS, or production hardening — out of scope for a learning lab
  and would obscure the core concepts being demonstrated.
- Don't swap `custom-lb`'s manual proxying for a library — that would defeat the purpose of
  the project.
- Don't merge `backend/`'s three instances into one parameterized thing that hides the
  "multiple independent servers" mental model — the separation is intentional, even though
  they share the same `server.js`.
