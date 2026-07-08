import type { IncomingMessage, ServerResponse } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildStoryboard, tiers, type MotionDirectorRequest } from "@motion-director/core";

const here = fileURLToPath(new URL(".", import.meta.url));
const candidateRoot = resolve(process.cwd());
const root = existsSync(resolve(candidateRoot, "apps/studio/public")) ? candidateRoot : resolve(here, "../../..");
const dataRoot = process.env.MOTION_DIRECTOR_DATA_DIR
  ? resolve(process.env.MOTION_DIRECTOR_DATA_DIR)
  : process.env.VERCEL
    ? "/tmp/motion-director"
    : resolve(root, "jobs");
const jobsDir = dataRoot;
const keyStoreFile = resolve(jobsDir, "api-keys.json");
const userStoreFile = resolve(jobsDir, "users.json");
const studioDir = resolve(root, "apps/studio/public");

mkdirSync(jobsDir, { recursive: true });

export async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  try {
    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, { ok: true, service: "motion-director", version: "0.1.0" });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/v1/tiers") {
      sendJson(res, 200, { tiers });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/v1/auth/google-demo") {
      const body = await readBody(req) as { email?: string; name?: string };
      const email = body.email?.trim().toLowerCase();
      if (!email || !email.includes("@")) {
        sendJson(res, 400, { error: "valid email required" });
        return;
      }
      const result = upsertSignup(email, body.name?.trim() || email.split("@")[0] || "Motion user");
      sendJson(res, 200, result);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/v1/api-keys") {
      if (!dashboardAuthorized(req)) return sendJson(res, 401, { error: "dashboard auth required" });
      const keys = readKeyStore().map(({ key, ...safe }) => ({
        ...safe,
        preview: `${key.slice(0, 11)}...${key.slice(-4)}`
      }));
      sendJson(res, 200, { keys });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/v1/api-keys") {
      if (!dashboardAuthorized(req)) return sendJson(res, 401, { error: "dashboard auth required" });
      const body = await readBody(req) as { name?: string; tier?: string };
      const key = `md_live_${randomBytes(24).toString("base64url")}`;
      const record = {
        id: randomBytes(6).toString("hex"),
        key,
        name: body.name || "Untitled key",
        tier: body.tier || "open-source",
        createdAt: new Date().toISOString(),
        lastUsedAt: null as string | null,
        usage: {
          storyboards: 0,
          renders: 0,
          audioSeconds: 0
        }
      };
      const keys = readKeyStore();
      keys.push(record);
      writeKeyStore(keys);
      sendJson(res, 201, {
        key: record.key,
        id: record.id,
        name: record.name,
        tier: record.tier,
        createdAt: record.createdAt,
        mcpConfig: mcpConfig(record.key)
      });
      return;
    }

    if (url.pathname.startsWith("/api/v1/jobs/")) {
      if (!authorized(req)) return sendJson(res, 401, { error: "missing or invalid bearer token" });
      const jobId = url.pathname.split("/").pop() ?? "";
      const file = resolve(jobsDir, jobId, "storyboard.json");
      if (!file.startsWith(jobsDir) || !existsSync(file)) {
        sendJson(res, 404, { error: "job not found", jobId });
        return;
      }
      sendJson(res, 200, JSON.parse(readFileSync(file, "utf8")));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/v1/generate-launch-film") {
      if (!authorized(req)) return sendJson(res, 401, { error: "missing or invalid bearer token" });
      const body = (await readBody(req)) as MotionDirectorRequest;
      const storyboard = buildStoryboard(body);
      const jobDir = resolve(jobsDir, storyboard.jobId);
      mkdirSync(jobDir, { recursive: true });
      writeFileSync(resolve(jobDir, "request.json"), JSON.stringify(body, null, 2));
      writeFileSync(resolve(jobDir, "storyboard.json"), JSON.stringify(storyboard, null, 2));
      markKeyUsed(req.headers.authorization, "storyboards");
      sendJson(res, 200, {
        status: "storyboard_ready",
        jobId: storyboard.jobId,
        jobDir,
        storyboard,
        next: "Use renderer-remotion or your hosted render worker to turn this manifest into MP4."
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/v1/render") {
      if (!authorized(req)) return sendJson(res, 401, { error: "missing or invalid bearer token" });
      const body = await readBody(req);
      sendJson(res, 202, {
        status: "render_queued",
        message: "Renderer adapter hook is ready; connect queue/remotion workers here.",
        input: body
      });
      return;
    }

    if (req.method === "GET") {
      serveStatic(res, url.pathname);
      return;
    }

    sendJson(res, 404, { error: "not found" });
  } catch (error) {
    sendJson(res, 500, { error: "internal error", detail: error instanceof Error ? error.message : String(error) });
  }
}

function authorized(req: IncomingMessage): boolean {
  if (process.env.MOTION_DIRECTOR_DEV_ALLOW_NO_AUTH === "1") return true;
  const expected = process.env.MOTION_DIRECTOR_API_KEY;
  if (expected && req.headers.authorization === `Bearer ${expected}`) return true;
  const token = bearer(req.headers.authorization);
  if (!token) return false;
  return readKeyStore().some((record) => record.key === token);
}

function dashboardAuthorized(req: IncomingMessage): boolean {
  if (process.env.MOTION_DIRECTOR_DEV_ALLOW_NO_AUTH === "1") return true;
  const adminKey = process.env.MOTION_DIRECTOR_ADMIN_KEY || process.env.MOTION_DIRECTOR_API_KEY;
  return Boolean(adminKey && req.headers.authorization === `Bearer ${adminKey}`);
}

function setCors(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const data = Buffer.from(JSON.stringify(payload, null, 2));
  res.writeHead(status, { "Content-Type": "application/json", "Content-Length": data.length });
  res.end(data);
}

interface ApiKeyRecord {
  id: string;
  key: string;
  name: string;
  tier: string;
  createdAt: string;
  lastUsedAt: string | null;
  usage: {
    storyboards: number;
    renders: number;
    audioSeconds: number;
  };
}

function readKeyStore(): ApiKeyRecord[] {
  if (!existsSync(keyStoreFile)) return [];
  try {
    return JSON.parse(readFileSync(keyStoreFile, "utf8")) as ApiKeyRecord[];
  } catch {
    return [];
  }
}

function writeKeyStore(keys: ApiKeyRecord[]): void {
  mkdirSync(jobsDir, { recursive: true });
  writeFileSync(keyStoreFile, JSON.stringify(keys, null, 2));
}

function bearer(value: string | undefined): string | undefined {
  if (!value?.startsWith("Bearer ")) return undefined;
  return value.slice("Bearer ".length).trim();
}

function markKeyUsed(auth: string | undefined, metric: "storyboards" | "renders"): void {
  const token = bearer(auth);
  if (!token) return;
  const keys = readKeyStore();
  const key = keys.find((record) => record.key === token);
  if (!key) return;
  key.lastUsedAt = new Date().toISOString();
  key.usage[metric] += 1;
  writeKeyStore(keys);
}

function mcpConfig(apiKey: string): Record<string, unknown> {
  return {
    mcpServers: {
      "motion-director": {
        command: "npx",
        args: ["-y", "@motion-director/mcp-server"],
        env: {
          MOTION_DIRECTOR_API_KEY: apiKey,
          MOTION_DIRECTOR_URL: "https://api.your-domain.com"
        }
      }
    }
  };
}

interface UserRecord {
  id: string;
  email: string;
  name: string;
  status: "active" | "waitlisted";
  waitlistNumber: number | null;
  createdAt: string;
}

function readUsers(): UserRecord[] {
  if (!existsSync(userStoreFile)) return [];
  try {
    return JSON.parse(readFileSync(userStoreFile, "utf8")) as UserRecord[];
  } catch {
    return [];
  }
}

function writeUsers(users: UserRecord[]): void {
  mkdirSync(jobsDir, { recursive: true });
  writeFileSync(userStoreFile, JSON.stringify(users, null, 2));
}

function upsertSignup(email: string, name: string): UserRecord & { message: string } {
  const users = readUsers();
  const existing = users.find((user) => user.email === email);
  if (existing) {
    return {
      ...existing,
      message: existing.status === "waitlisted" ? waitlistMessage(existing.waitlistNumber ?? 1) : "You are in. Go make something loud."
    };
  }

  const activeCount = users.filter((user) => user.status === "active").length;
  const waitlistedCount = users.filter((user) => user.status === "waitlisted").length;
  const status: UserRecord["status"] = activeCount < 10 ? "active" : "waitlisted";
  const waitlistNumber = status === "waitlisted" ? waitlistedCount + 1 : null;
  const user: UserRecord = {
    id: randomBytes(6).toString("hex"),
    email,
    name,
    status,
    waitlistNumber,
    createdAt: new Date().toISOString()
  };
  users.push(user);
  writeUsers(users);

  return {
    ...user,
    message: status === "waitlisted" ? waitlistMessage(waitlistNumber ?? 1) : "You are in. Go make something loud."
  };
}

function waitlistMessage(number: number): string {
  return `You are #${number} on the waitlist. welp im broke and solo, so im letting people in slowly.`;
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("error", reject);
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8").trim();
      if (!raw) return resolveBody({});
      try {
        resolveBody(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function serveStatic(res: ServerResponse, pathname: string): void {
  const cleanPath = pathname === "/" ? "/index.html" : pathname;
  const file = resolve(studioDir, `.${cleanPath}`);
  if (!file.startsWith(studioDir) || !existsSync(file) || !statSync(file).isFile()) {
    sendJson(res, 404, { error: "not found" });
    return;
  }
  const types: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json"
  };
  const data = readFileSync(file);
  res.writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream" });
  res.end(data);
}
