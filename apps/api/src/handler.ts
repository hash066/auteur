import type { IncomingMessage, ServerResponse } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
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

    if (req.method === "GET" && url.pathname === "/api/v1/auth/google/start") {
      const clientId = process.env.AUTH_GOOGLE_ID;
      const clientSecret = process.env.AUTH_GOOGLE_SECRET;
      const authSecret = process.env.AUTH_SECRET;
      if (!clientId || !clientSecret || !authSecret) {
        sendJson(res, 500, { error: "google auth is not configured" });
        return;
      }
      const state = randomBytes(24).toString("base64url");
      const origin = requestOrigin(req);
      const redirectUri = googleRedirectUri(req);
      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", "openid email profile");
      authUrl.searchParams.set("state", state);
      authUrl.searchParams.set("access_type", "offline");
      authUrl.searchParams.set("prompt", "consent");
      setCookie(res, "md_oauth_state", state, {
        httpOnly: true,
        secure: origin.startsWith("https://"),
        sameSite: "Lax",
        maxAgeSeconds: 600
      });
      redirect(res, authUrl.toString());
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/v1/auth/google/callback") {
      const authSecret = process.env.AUTH_SECRET;
      const state = url.searchParams.get("state") ?? "";
      const code = url.searchParams.get("code") ?? "";
      const error = url.searchParams.get("error");
      if (error) {
        redirect(res, "/?auth=error");
        return;
      }
      if (!authSecret) {
        redirect(res, "/?auth=config");
        return;
      }
      const cookies = parseCookies(req.headers.cookie);
      const expectedState = cookies.md_oauth_state ?? "";
      if (!state || !expectedState || state !== expectedState || !code) {
        clearCookie(res, "md_oauth_state");
        redirect(res, "/?auth=state");
        return;
      }

      const token = await exchangeGoogleCode(req, code);
      const profile = await loadGoogleProfile(token.access_token);
      if (!profile.email) {
        clearCookie(res, "md_oauth_state");
        redirect(res, "/?auth=email");
        return;
      }
      const signup = upsertSignup(profile.email.toLowerCase(), profile.name || profile.email.split("@")[0] || "Motion user");
      const sessionToken = createSessionToken({
        email: signup.email,
        name: signup.name
      }, authSecret);
      setCookie(res, "md_session", sessionToken, {
        httpOnly: true,
        secure: requestOrigin(req).startsWith("https://"),
        sameSite: "Lax",
        maxAgeSeconds: 60 * 60 * 24 * 30
      });
      clearCookie(res, "md_oauth_state");
      redirect(res, "/dashboard.html?auth=ok");
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/v1/auth/session") {
      const authSecret = process.env.AUTH_SECRET;
      if (!authSecret) {
        sendJson(res, 200, { signedIn: false, configured: false });
        return;
      }
      const cookies = parseCookies(req.headers.cookie);
      const token = cookies.md_session;
      if (!token) {
        sendJson(res, 200, { signedIn: false, configured: true });
        return;
      }
      const session = readSessionToken(token, authSecret);
      if (!session) {
        sendJson(res, 200, { signedIn: false, configured: true });
        return;
      }
      const users = readUsers();
      const user = users.find((item) => item.email === session.email);
      if (!user) {
        sendJson(res, 200, { signedIn: false, configured: true });
        return;
      }
      sendJson(res, 200, {
        signedIn: true,
        configured: true,
        user: {
          email: user.email,
          name: user.name,
          status: user.status,
          waitlistNumber: user.waitlistNumber
        },
        message: user.status === "waitlisted" ? waitlistMessage(user.waitlistNumber ?? 1) : "You are in. Go make something loud."
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/v1/auth/logout") {
      clearCookie(res, "md_session");
      sendJson(res, 200, { ok: true });
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
  if (adminKey && req.headers.authorization === `Bearer ${adminKey}`) return true;
  const authSecret = process.env.AUTH_SECRET;
  if (!authSecret) return false;
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies.md_session;
  if (!token) return false;
  return Boolean(readSessionToken(token, authSecret));
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

interface SessionPayload {
  email: string;
  name: string;
  exp: number;
}

function createSessionToken(payload: { email: string; name: string }, secret: string): string {
  const session: SessionPayload = {
    email: payload.email,
    name: payload.name,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 30
  };
  const encoded = Buffer.from(JSON.stringify(session)).toString("base64url");
  const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function readSessionToken(token: string, secret: string): SessionPayload | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  const expected = createHmac("sha256", secret).update(encoded).digest("base64url");
  const signatureBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (signatureBytes.length !== expectedBytes.length) return null;
  if (!timingSafeEqual(signatureBytes, expectedBytes)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionPayload;
    if (!decoded.email || decoded.exp < Date.now()) return null;
    return decoded;
  } catch {
    return null;
  }
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

function requestOrigin(req: IncomingMessage): string {
  const proto = (req.headers["x-forwarded-proto"] as string | undefined) || "http";
  const hostHeader = (req.headers["x-forwarded-host"] as string | undefined) || req.headers.host || "localhost:3000";
  return `${proto}://${hostHeader}`;
}

function googleRedirectUri(req: IncomingMessage): string {
  return `${requestOrigin(req)}/api/v1/auth/google/callback`;
}

interface GoogleTokenResponse {
  access_token: string;
}

async function exchangeGoogleCode(req: IncomingMessage, code: string): Promise<GoogleTokenResponse> {
  const clientId = process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;
  if (!clientId || !clientSecret) throw new Error("google auth is not configured");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: googleRedirectUri(req),
      grant_type: "authorization_code"
    })
  });
  const json = await response.json() as GoogleTokenResponse & { error?: string };
  if (!response.ok || !json.access_token) {
    throw new Error(json.error || "google token exchange failed");
  }
  return { access_token: json.access_token };
}

interface GoogleProfile {
  email?: string;
  name?: string;
}

async function loadGoogleProfile(accessToken: string): Promise<GoogleProfile> {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  const json = await response.json() as GoogleProfile;
  if (!response.ok) throw new Error("google profile fetch failed");
  return json;
}

interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Lax" | "Strict" | "None";
  path?: string;
  maxAgeSeconds?: number;
}

function setCookie(res: ServerResponse, name: string, value: string, options: CookieOptions = {}): void {
  const path = options.path || "/";
  const sameSite = options.sameSite || "Lax";
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, `SameSite=${sameSite}`];
  if (typeof options.maxAgeSeconds === "number") parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAgeSeconds))}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  appendSetCookie(res, parts.join("; "));
}

function clearCookie(res: ServerResponse, name: string): void {
  setCookie(res, name, "", { maxAgeSeconds: 0, path: "/" });
}

function appendSetCookie(res: ServerResponse, cookie: string): void {
  const current = res.getHeader("Set-Cookie");
  if (!current) {
    res.setHeader("Set-Cookie", cookie);
    return;
  }
  if (Array.isArray(current)) {
    res.setHeader("Set-Cookie", [...current, cookie]);
    return;
  }
  res.setHeader("Set-Cookie", [String(current), cookie]);
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return header
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((all, item) => {
      const eq = item.indexOf("=");
      if (eq < 0) return all;
      const key = item.slice(0, eq).trim();
      const value = item.slice(eq + 1).trim();
      all[key] = decodeURIComponent(value);
      return all;
    }, {});
}

function redirect(res: ServerResponse, location: string): void {
  res.writeHead(302, { Location: location });
  res.end();
}
