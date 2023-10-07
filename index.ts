import Fastify from "fastify";
import path from "path";
import staticPlugin from "@fastify/static";
import WebSocket from "ws";
import chokidar from "chokidar";
import debounce from 'lodash.debounce';  // You'll need to install lodash for this

const fastify = Fastify();
const server = fastify.server;

fastify.register(staticPlugin, {
  root: path.join(__dirname, "frontend"),
});

fastify.get('/', async (request, reply) => {
  return reply.sendFile('index.html');
});

const connections: Set<WebSocket> = new Set();
const wss = new WebSocket.Server({ noServer: true });

wss.on("connection", (ws: WebSocket) => {
  connections.add(ws);
  ws.on("close", () => {
    connections.delete(ws);
  });
});

server.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});

const reloadClients = debounce(() => {
  console.log("Reloading clients.");
  for (const ws of connections) {
    ws.send("reload");
  }
}, 300);  // 300ms debounce time

const watcher = chokidar.watch(path.join(__dirname, "frontend"), {
  ignored: /(^|[\/\\])\../  // ignore dotfiles
});

watcher.on("change", (filePath) => {
  if (filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.endsWith('.css')) {
    console.log(`File ${filePath} has been changed`);
    reloadClients();
  }
});

const port = parseInt(process.env.PORT as string, 10) || 3000;

fastify.listen({ port: port, host: '0.0.0.0' }, (err) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.log(`Server listening on ${port}`);
});
