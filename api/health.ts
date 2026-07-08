import type { IncomingMessage, ServerResponse } from "node:http";
import { handleRequest } from "../apps/api/src/handler.js";

export default function health(req: IncomingMessage, res: ServerResponse): Promise<void> {
  req.url = "/health";
  return handleRequest(req, res);
}
