const http = require('http');
const { parse } = require('url');
const path = require('path');
const next = require('next');

const dev = false;
const hostname = '127.0.0.1';
const port = parseInt(process.env.PORT, 10) || 3001;
const dir = path.resolve(__dirname);

console.log(`[NextServer] Starting Next.js at ${hostname}:${port} in ${dir}`);

const app = next({
  dev,
  hostname,
  port,
  dir
});

const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = http.createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('[NextServer] Request error:', req.url, err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  server.listen(port, hostname, (err) => {
    if (err) {
      console.error('[NextServer] Listen error:', err);
      process.exit(1);
    }
    console.log(`[NextServer] Ready on http://${hostname}:${port}`);
  });
}).catch((err) => {
  console.error('[NextServer] Prepare error:', err);
  process.exit(1);
});
