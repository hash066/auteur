import { createServer } from "node:http";
import { handleRequest } from "./handler.js";

const port = Number(process.env.PORT ?? 3000);

const server = createServer(handleRequest);

server.listen(port, () => {
  console.log(`Motion Director API listening on http://localhost:${port}`);
});
