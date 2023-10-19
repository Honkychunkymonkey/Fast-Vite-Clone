import Fastify from "fastify";
import path from "path";
import staticPlugin from "@fastify/static";
import WebSocket from "ws";
import chokidar from "chokidar";
import debounce from 'lodash.debounce';
import crypto from "crypto";
import fs from "fs/promises";
import type { FileHashes } from './FileHashes';
import { FileType } from './FileType';
import config from "./vc.config";

// Initialize Fastify and other variables
const fastify = Fastify();
const server = fastify.server;
const fileHashes: FileHashes = {};
const connections: Set<WebSocket> = new Set();

const computeHash = (content: string, fileType: FileType) => {
  let cleaned: string;
  switch (fileType) {
    case FileType.HTML:
      cleaned = content.replace(/<!--[\s\S]*?-->/g, '');
      cleaned = cleaned.replace(/>\s+</g, '><');
      cleaned = cleaned.replace(/<\s+/g, '<');
      cleaned = cleaned.replace(/\s+>/g, '>');
      break;
    case FileType.JS:
    case FileType.CSS:
      cleaned = content.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '');
      break;
    default:
      cleaned = content;
      break;
  }
  return crypto.createHash('sha1').update(cleaned).digest('hex');
};

const getFileType = (filePath: string): FileType | undefined => {
  if (filePath.endsWith('.html')) return FileType.HTML;
  if (filePath.endsWith('.js')) return FileType.JS;
  if (filePath.endsWith('.css')) return FileType.CSS;
  if (filePath.endsWith('.jsx')) return FileType.JSX;
  return undefined;
};

const readAndUpdateFile = async (filePath: string) => {
const fileType = getFileType(filePath);
if (!fileType) return;

  try {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const newHash = computeHash(fileContent, fileType);
    if (fileHashes[filePath] !== newHash) {
      console.log(`File ${filePath} has meaningful changes`);
      reloadClients();
      fileHashes[filePath] = newHash;
    } else {
      console.log(`File ${filePath} has no meaningful changes`);
    }
  } catch (err) {
    console.error(`Failed to read ${filePath}: ${err}`);
  }
// Call into the plugins
  await runPluginFileHooks(filePath, fileType);
};


const runPluginFileHooks = async (filePath: string, fileType: FileType) => {
  for (const plugin of config.plugins) {
    if (plugin.onFileChange) {
      await plugin.onFileChange(filePath, fileType);
    }
  }
};
        
console.log("Before registering the first static plugin");
fastify.register(staticPlugin, {
  root: path.join(__dirname, config.srcDir),
});
console.log("After registering the first static plugin");

console.log("Before registering the second static plugin");
fastify.register(staticPlugin, {
  root: path.join(__dirname, config.outDir),
  prefix: '/dist/',
});
console.log("After registering the second static plugin");


// Add this somewhere in your index.ts
let determinedEntryPoint: string | null = null;

const resolveEntryPoint = (): string => {
  if (determinedEntryPoint) {
    return determinedEntryPoint;
  }

  if (config.entryPoint) {
    if (config.entryPoint.includes('.')) {
      return config.entryPoint;
    }
    // No extension provided, resolve dynamically
    const ext = config.plugins.length > 0 ? (config.plugins[0]?.defaultExtension ? config.plugins[0].defaultExtension(config.typescript) : 'jsx') : 'jsx';
    return `${config.entryPoint}.${ext}`;
  }

  // No entry point specified, use the plugin default or 'jsx'
  const ext = config.plugins.length > 0 ? (config.plugins[0]?.defaultExtension ? config.plugins[0].defaultExtension(config.typescript) : 'jsx') : 'jsx';
  return `App.${ext}`;
};


const runServerStartHooks = async () => {
  for (const plugin of config.plugins) {
    if (plugin.onServerStart) {
      await plugin.onServerStart();
    }
    if (plugin.determineEntryFile) {
      const entryFile = await plugin.determineEntryFile();
      if (entryFile) {
        determinedEntryPoint = entryFile;  // Updating global variable
      }
    }
  }
};

fastify.get('/', async (request, reply) => {
  return reply.sendFile('main.html'); // Serve main.html instead of the JSX entry point
});


const wss = new WebSocket.Server({ noServer: true, perMessageDeflate: true });

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
    ws.send("reload-main"); // Reload main.html
  }
}, 50);

// File watcher setup
const watcher = chokidar.watch(path.join(__dirname, "frontend"), { ignored: /(^|[\/\\])\../ });

// Initial Hash Population
const populateInitialHashes = async () => {
  const files = await fs.readdir(path.join(__dirname, "frontend"));
  await Promise.all(files.map(async (file) => {
    const filePath = path.join(__dirname, "frontend", file);
    await readAndUpdateFile(filePath);
  }));
};

populateInitialHashes().then(() => {
  watcher.on("change", readAndUpdateFile);
});

// Server Listening
const port = parseInt(process.env.PORT ?? `${config.port}`, 10);

// First, run server start hooks
runServerStartHooks().then(() => {
  // After hooks have been run, start the Fastify server
  fastify.listen({ port, host: '0.0.0.0' }, (err) => {
    if (err) {
      fastify.log.error(err);
      process.exit(1);
    }
    console.log(`Server listening on ${port}`);
  });
});