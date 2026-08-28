const http = require("http"); // built-in module, no install needed

const NAME = process.env.BACKEND_NAME || "backend";
let healthy = true;

const send = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "text/plain" });
  res.end(body);
};

const server = http.createServer((req, res) => {
  console.log(`[${NAME}] ${req.method} ${req.url}`);
  if (req.url === "/toggle-health") {
    healthy = !healthy;
    send(res, 200, `healthy: ${healthy}\n`);
  } else if (req.url === "/health") {
    send(res, healthy ? 200 : 500, `healthy: ${healthy}\n`);
  } else {
    send(res, 200, `Hello from ${NAME}\n`);
  }
});

server.listen(3000, () => {
  console.log("backend listening on port 3000");
});
