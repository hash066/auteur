import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { analyzeAudio } from "@motion-director/audio-analysis";
import { buildStoryboard, tiers } from "@motion-director/core";

const server = new McpServer({
  name: "motion-director",
  version: "0.1.0"
});

server.tool(
  "generate_storyboard",
  "Create a cinematic product launch film storyboard from repo context, captures, vibe, and duration.",
  {
    productName: z.string().optional(),
    repoPath: z.string().optional(),
    durationSeconds: z.number().optional(),
    vibe: z.string().optional(),
    captures: z.array(z.string()).optional()
  },
  async (input) => {
    const hosted = await callHostedApi(input);
    if (hosted) {
      return {
        content: [{ type: "text", text: JSON.stringify(hosted, null, 2) }]
      };
    }
    const storyboard = buildStoryboard(input);
    return {
      content: [{ type: "text", text: JSON.stringify(storyboard, null, 2) }]
    };
  }
);

server.tool(
  "analyze_audio",
  "Create a beat map for cutting launch-film motion to music.",
  {
    path: z.string().optional(),
    durationSeconds: z.number().optional(),
    ffmpegPath: z.string().optional()
  },
  async (input) => {
    const beatMap = analyzeAudio(input);
    return {
      content: [{ type: "text", text: JSON.stringify(beatMap, null, 2) }]
    };
  }
);

server.tool(
  "plan_cursorful_motion",
  "Create Cursorful-style camera instructions for a storyboard shot.",
  {
    target: z.string(),
    clickTime: z.number().optional(),
    side: z.enum(["left", "right"]).optional()
  },
  async (input) => {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              target: input.target,
              camera: "fast focal push, 0.35s in, 0.6s hold, 0.28s ease out",
              cursor: input.clickTime == null ? "hidden unless hover is meaningful" : `show cursor around ${input.clickTime}s with expanding click ring`,
              sideCallout: input.side ?? "right",
              rule: "do not cover dense UI text"
            },
            null,
            2
          )
        }
      ]
    };
  }
);

server.tool(
  "list_pricing_tiers",
  "List recommended hosted Motion Director pricing tiers and credit limits.",
  {},
  async () => ({
    content: [{ type: "text", text: JSON.stringify(tiers, null, 2) }]
  })
);

const transport = new StdioServerTransport();
await server.connect(transport);

async function callHostedApi(input: unknown): Promise<unknown | null> {
  const baseUrl = process.env.MOTION_DIRECTOR_URL;
  const key = process.env.MOTION_DIRECTOR_API_KEY;
  if (!baseUrl || !key) return null;

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/v1/generate-launch-film`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`
    },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Motion Director API failed: ${response.status} ${text}`);
  }

  return response.json();
}
