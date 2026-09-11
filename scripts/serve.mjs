import { createServer } from "node:http";
import { stat, readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
const root = resolve("out");
const port = Number(process.env.PORT || 3001);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
};
createServer(async (req, res) => {
  try {
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405);
      res.end();
      return;
    }
    const url = new URL(req.url, "http://localhost");
    const pathname = decodeURIComponent(url.pathname);
    let target = resolve(root, "." + pathname);
    if (target !== root && !target.startsWith(root + sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    if ((await stat(target)).isDirectory())
      target = resolve(target, "index.html");
    const body = await readFile(target);
    res.setHeader(
      "Content-Type",
      mime[extname(target)] || "application/octet-stream",
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
      "Cache-Control",
      pathname.startsWith("/_next/static/")
        ? "public, max-age=31536000, immutable"
        : "no-cache",
    );
    if (pathname === "/sw.js") res.setHeader("Service-Worker-Allowed", "/");
    res.writeHead(200);
    res.end(req.method === "HEAD" ? undefined : body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    try {
      res.end(await readFile(resolve(root, "404.html")));
    } catch {
      res.end("Run npm run build first.");
    }
  }
}).listen(port, "0.0.0.0", () =>
  console.log(`CADRAN production preview: http://localhost:${port}`),
);
