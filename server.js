import http from "node:http";
import fs from "node:fs/promises";

const PORT = 8000;

const server = http.createServer(async (req, res) => {
  try {
    const url = (req.url ?? "/").split("?")[0];
    const file = url === "/" ? "./index.html" : `.${url}`;

    const data = await fs.readFile(file);

    const type = file.endsWith(".html")
      ? "text/html; charset=utf-8"
      : file.endsWith(".js")
        ? "application/javascript; charset=utf-8"
        : file.endsWith(".css")
          ? "text/css; charset=utf-8"
          : file.endsWith(".json")
            ? "application/json; charset=utf-8"
            : "application/octet-stream";

    res.writeHead(200, { "Content-Type": type });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
});

server.listen(PORT, () => {
  console.log(`StudySpaces static server: http://localhost:${PORT}`);
});
