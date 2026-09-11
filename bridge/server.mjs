// Optional local desktop adapter. This runs a configured JSON stdio wrapper, not a simulated Codex/Claude integration.
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { randomBytes, timingSafeEqual } from "node:crypto";
const host = "127.0.0.1";
const port = Number(process.env.CADRAN_BRIDGE_PORT || 4318);
const origin = process.env.CADRAN_APP_ORIGIN || "http://localhost:3000";
const token =
  process.env.CADRAN_BRIDGE_TOKEN || randomBytes(32).toString("hex");
const executable = process.env.CADRAN_AGENT_EXECUTABLE;
const args = JSON.parse(process.env.CADRAN_AGENT_ARGS || "[]");
if (!executable)
  throw new Error(
    "Set CADRAN_AGENT_EXECUTABLE to a JSON stdio agent wrapper. See bridge/README.md.",
  );
if (!Array.isArray(args) || args.some((x) => typeof x !== "string"))
  throw new Error("CADRAN_AGENT_ARGS must be a JSON string array.");
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("Invalid port.");
let busy = false;
const server = createServer(async (req, res) => {
  const requestOrigin = req.headers.origin;
  if (requestOrigin !== origin) {
    res.writeHead(403);
    res.end("Origin denied");
    return;
  }
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization",
    );
    res.writeHead(204);
    res.end();
    return;
  }
  const auth = Buffer.from(req.headers.authorization || "");
  const expected = Buffer.from("Bearer " + token);
  if (auth.length !== expected.length || !timingSafeEqual(auth, expected)) {
    res.writeHead(401);
    res.end("Unauthorized");
    return;
  }
  if (req.method !== "POST" || req.url !== "/v1/chat/completions") {
    res.writeHead(404);
    res.end();
    return;
  }
  if (busy) {
    res.writeHead(429);
    res.end("One analysis at a time");
    return;
  }
  const send = (status, body) => {
    if (!res.destroyed && !res.writableEnded) {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    }
  };
  let payload = "";
  try {
    for await (const chunk of req) {
      payload += chunk;
      if (Buffer.byteLength(payload) > 24 * 1024 * 1024) {
        send(413, { error: "Request too large" });
        return;
      }
    }
  } catch {
    return;
  }
  let parsed;
  try {
    parsed = JSON.parse(payload);
    if (!Array.isArray(parsed.messages) || typeof parsed.model !== "string")
      throw new Error();
  } catch {
    send(400, { error: "Expected OpenAI-compatible messages and model" });
    return;
  }
  busy = true;
  const child = spawn(executable, args, {
    shell: false,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  let output = "";
  let finished = false;
  const finish = (status, result) => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    busy = false;
    send(status, result);
  };
  const timer = setTimeout(() => {
    child.kill();
    finish(504, { error: "Agent timed out" });
  }, 85000);
  res.on("close", () => {
    if (!res.writableEnded) {
      child.kill();
      clearTimeout(timer);
      busy = false;
      finished = true;
    }
  });
  child.on("error", () =>
    finish(502, { error: "Could not start configured wrapper" }),
  );
  child.stdin.on("error", () => {});
  child.stdout.on("data", (chunk) => {
    output += chunk;
    if (Buffer.byteLength(output) > 4 * 1024 * 1024) {
      child.kill();
      finish(502, { error: "Agent output too large" });
    }
  });
  child.stderr.resume();
  child.on("close", (code) => {
    if (finished) return;
    if (code !== 0) {
      finish(502, { error: "Agent wrapper failed" });
      return;
    }
    try {
      const result = JSON.parse(output);
      if (typeof result.choices?.[0]?.message?.content !== "string")
        throw new Error();
      finish(200, result);
    } catch {
      finish(502, {
        error: "Wrapper must return an OpenAI-compatible JSON response",
      });
    }
  });
  child.stdin.end(JSON.stringify(parsed));
});
server.listen(port, host, () => {
  console.log(`CADRAN local adapter http://${host}:${port}/v1`);
  console.log(`Allowed origin: ${origin}`);
  console.log(`Bridge API key (session): ${token}`);
});
