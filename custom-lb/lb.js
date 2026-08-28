const http = require("http");

const backends = [
  { host: "localhost", port: 3001, healthy: true, connections: 0 },
  { host: "localhost", port: 3002, healthy: true, connections: 0 },
  { host: "localhost", port: 3003, healthy: true, connections: 0 },
];

let rrIndex = 0;

const pickBackendRoundRobin = (backends) => {
  const backend = backends[rrIndex];
  rrIndex = (rrIndex + 1) % backends.length;
  return backend;
};

const setHealth = (backend, value) => {
  if (backend.healthy !== value) {
    console.log(
      `health: ${backend.host}:${backend.port} is now ${value ? "UP" : "DOWN"}`,
    );
  }
  backend.healthy = value;
};

const checkHealth = (backend) => {
  const req = http.request(
    {
      host: backend.host,
      port: backend.port,
      path: "/health",
      method: "GET",
      timeout: 2000, // don't wait forever on a hung backend
    },
    (res) => {
      setHealth(backend, res.statusCode === 200); // 200 = healthy, anything else = not
      res.resume(); // drain the response body so the socket is freed
    },
  );

  req.on("error", () => setHealth(backend, false)); // couldn't connect → down
  req.on("timeout", () => {
    req.destroy(); // abort the hung request
    setHealth(backend, false); // → down
  });

  req.end(); // actually send it
};

const HEALTH_CHECK_INTERVAL = 3000; // every 3 seconds

const runHealthChecks = () => backends.forEach(checkHealth);
runHealthChecks(); // check right away at startup
setInterval(runHealthChecks, HEALTH_CHECK_INTERVAL); // then every 3s

const pickBackendLeastConnections = (backends) => {
  return backends.reduce((best, b) =>
    b.connections < best.connections ? b : best,
  );
};

const ALGORITHM = process.env.ALGORITHM || "round-robin";

const pickBackend =
  ALGORITHM === "least-connections"
    ? pickBackendLeastConnections
    : pickBackendRoundRobin;

console.log(`load balancing algorithm: ${ALGORITHM}`);

const server = http.createServer((clientReq, clientRes) => {
  // We are the SERVER here: clientReq / clientRes talk to the browser.

  const healthyBackends = backends.filter((b) => b.healthy);

  // If everything is down, we have nowhere to send this.
  if (healthyBackends.length === 0) {
    clientRes.writeHead(503, { "Content-Type": "text/plain" });
    clientRes.end("No healthy backends\n");
    return;
  }

  const backend = pickBackend(healthyBackends);
  backend.connections++; // one more active request
  console.log(
    `→ routing to ${backend.host}:${backend.port} (conns: ${backend.connections})`,
  );

  // When THIS response finishes (success OR failure), free the slot.
  clientRes.on("close", () => {
    backend.connections--;
  });

  // Now act as a CLIENT: describe the request we'll make to the backend.
  const options = {
    host: backend.host,
    port: backend.port,
    path: clientReq.url,
    method: clientReq.method,
    headers: clientReq.headers,
  };

  // Open the outgoing request to the backend.
  const proxyReq = http.request(options, (backendRes) => {
    // This runs when the backend starts responding.
    // Relay the backend's status + headers back to the client...
    clientRes.writeHead(backendRes.statusCode, backendRes.headers);
    // ...then stream the backend's body straight to the client.
    backendRes.pipe(clientRes);
  });

  // Stream the client's request body to the backend.
  clientReq.pipe(proxyReq);

  // If the backend is unreachable, don't crash — return 502.
  proxyReq.on("error", (err) => {
    console.error(`proxy error: ${err.message}`);
    clientRes.writeHead(502, { "Content-Type": "text/plain" });
    clientRes.end("Bad gateway\n");
  });
});

server.listen(8080, () => {
  console.log("custom-lb listening on port 8080");
});
