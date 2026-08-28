# load-balancer-lab

![Node.js](https://img.shields.io/badge/Node.js-5FA04E?style=for-the-badge&logo=nodedotjs&logoColor=white)
![nginx](https://img.shields.io/badge/nginx-009639?style=for-the-badge&logo=nginx&logoColor=white)
![HAProxy](https://img.shields.io/badge/HAProxy-106DA9?style=for-the-badge&logo=haproxy&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)

A hands-on lab for **understanding load balancing** by building and comparing three
approaches side by side — a hand-rolled one, nginx, and HAProxy — all doing the same job in
front of the same backend servers.

This is a **learning project, not a production system.** The goal is to be able to explain
what every line does, not to ship something.

---

## The problem this explores

A single web server has limits: it can only handle so many requests, and if it goes down,
your whole app goes down with it. The standard answer is to run **several identical copies**
of the server and put a **load balancer** in front of them.

A load balancer has two core jobs:

1. **Distribute traffic** — spread incoming requests across the backend servers so no single
   one is overwhelmed (using an *algorithm* like round-robin or least-connections).
2. **Route around failure** — notice when a backend is unhealthy and **stop sending it
   traffic** (via *health checks*), so users don't hit a dead server.

This lab makes both jobs concrete: you run three backend servers, put a load balancer in
front, watch requests get distributed, then **kill a backend on purpose** and watch the load
balancer route around it.

---

## What this project is

The same setup is implemented **three different ways** so you can compare them directly. All
three proxy the **same three backend servers**:

| Approach | What it is | What it demonstrates |
|---|---|---|
| **`custom-lb/`** | A load balancer hand-written in plain Node.js | The actual *mechanics* — how proxying, round-robin / least-connections selection, and **active health checks** work, with nothing hidden behind a library. This is the core learning artifact. |
| **`nginx/`** | The same job, done with an nginx config | How a real-world reverse proxy is configured — and its limitation: **open-source nginx only has *passive* health checks** (it reacts to failed requests; it can't actively poll `/health`). That gap is itself part of the lesson. |
| **`haproxy/`** | The same job, done with an HAProxy config | A purpose-built load balancer with **active health checks** *and* a **live stats dashboard** you can watch in the browser. |

The interesting part is the **contrast**: the hand-rolled version shows you the mechanics,
and the nginx/HAProxy versions show how the same ideas look in production tools — including
where they differ (like nginx's missing active health checks).

---

## Architecture

```
                         ┌──────────────┐
      HTTP request  ───▶ │ Load balancer│   (custom-lb / nginx / haproxy)
                         └──────┬───────┘
                                │  distributes + health-checks
              ┌─────────────────┼─────────────────┐
              ▼                  ▼                  ▼
        ┌──────────┐      ┌──────────┐      ┌──────────┐
        │ backend1 │      │ backend2 │      │ backend3 │
        └──────────┘      └──────────┘      └──────────┘
        identical Node servers, each identifies itself + has /health
```

Every service runs in its own **Docker container**, and they find each other by
**service name** (`backend1`, `backend2`, `backend3`) via Docker's internal DNS — no
hardcoded IP addresses.

---

## Tech stack

| Technology | Role | Why |
|---|---|---|
| **Node.js** (built-in `http` module, **no dependencies**) | The backend servers and the `custom-lb` load balancer | Seeing the raw proxying and health-check logic directly — no framework hiding the mechanics. |
| **nginx** | Comparison load balancer | Ubiquitous production reverse proxy / load balancer. |
| **HAProxy** | Comparison load balancer | Dedicated load balancer with active health checks and a stats dashboard. |
| **Docker Compose** | Runs the whole system | Lets three identical backends run at once (each on its own port), find each other by name, and start the mixed stack (Node + nginx + HAProxy) with one command. |

> **No npm packages** are used in `backend/` or `custom-lb/` — on purpose. The point of
> `custom-lb/lb.js` is to read the proxying and health-check code directly, using only Node's
> built-in `http` module.

---

## The backend servers

Three identical Node servers (all run the same `backend/server.js`, told apart by the
`BACKEND_NAME` env var). Each one:

- Identifies itself — `GET /` returns `Hello from backend1`
- Has a health endpoint — `GET /health` returns `200` when healthy
- Can **fake failure** — `GET /toggle-health` flips its health state, so `/health` starts
  returning `500`. This is how you simulate a backend dying to watch the load balancer react.

---

## Repo structure

```
backend/            # Dummy backend server (Node, no dependencies)
custom-lb/          # Hand-rolled load balancer — the core learning artifact
nginx/              # nginx.conf
haproxy/            # haproxy.cfg
docker-compose.yml  # Wires up the 3 backends + the load balancers
```

---

## Getting started

> **Status:** this lab is being built incrementally (see [Roadmap](#roadmap) below). Not all
> of the commands here work yet — they describe the intended setup.

Start everything:

```bash
docker compose up --build
```

Watch the hand-rolled load balancer's health-check logs:

```bash
docker compose logs -f custom-lb
```

Simulate a backend dying (then watch the load balancer route around it):

```bash
docker compose exec backend2 wget -qO- localhost:3000/toggle-health
```

Run it again to bring the backend back to healthy.

---

## Load balancing algorithms

The `custom-lb` implements these as pure functions, selected via the `ALGORITHM` env var:

- **Round-robin** — hand each request to the next backend in order, cycling back to the
  start. Simple and even.
- **Least-connections** — send each request to whichever backend currently has the fewest
  in-flight requests. Adapts better when requests take uneven amounts of time.

---

## Roadmap

What's built so far, and what's next:

- [x] `backend/server.js` — dummy backend with `/health` and `/toggle-health`, per-request logging
- [x] Docker setup — run three backends at once, reachable by name
- [x] `custom-lb/lb.js` — the hand-rolled load balancer (round-robin, least-connections, active health checks)
- [ ] `nginx/nginx.conf` — the nginx equivalent
- [ ] `haproxy/haproxy.cfg` — the HAProxy equivalent, with stats dashboard

---

## A note on scope

This is a learning lab, so it deliberately **leaves out** production concerns —
authentication, TLS, and hardening are out of scope, because they'd obscure the core ideas
being demonstrated.
