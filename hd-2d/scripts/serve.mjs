import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

const root = resolve(import.meta.dirname, "../dist");
const portText = process.env.PORT ?? "4310";
if (!/^\d+$/.test(portText) || Number(portText) < 1 || Number(portText) > 65535) throw new Error("PORT must be an integer from 1 to 65535");
const port = Number(portText);
const server = createServer(async (request, response) => {
  try {
    const decoded = decodeURIComponent((request.url ?? "/").split("?")[0]);
    const relative = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
    const file = resolve(root, relative);
    if (!(file === root || file.startsWith(`${root}${sep}`)) || extname(file) !== ".html") {
      response.writeHead(400).end("bad path");
      return;
    }
    response.setHeader("content-type", "text/html; charset=utf-8");
    response.end(await readFile(file));
  } catch (error) {
    const status = error instanceof URIError ? 400 : 404;
    response.writeHead(status).end(status === 400 ? "bad path" : "not found");
  }
});
server.on("error", (error) => { console.error(error); process.exitCode = 1; });
server.listen(port, "127.0.0.1", () => console.log(`http://127.0.0.1:${port}`));
