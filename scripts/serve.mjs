import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
const root = path.resolve(import.meta.dirname, "../docs");
const port = Number(process.env.PORT || 8000);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};
http
  .createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      const target = path.resolve(
        root,
        "." + (pathname.endsWith("/") ? pathname + "index.html" : pathname),
      );
      if (!target.startsWith(root + path.sep)) {
        res.writeHead(403).end("Forbidden");
        return;
      }
      const content = await fs.readFile(target);
      res.writeHead(200, {
        "Content-Type":
          types[path.extname(target)] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(content);
    } catch {
      res.writeHead(404).end("Not found");
    }
  })
  .listen(port, "127.0.0.1", () =>
    console.log(`Dashboard: http://127.0.0.1:${port}`),
  );
