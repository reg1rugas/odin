import {
  identity,
  jsonBody,
  fail,
  ApiError,
  readOne,
  save,
  mcpRequest,
  initializeMcp,
} from "@/lib/server";
export async function POST(request: Request) {
  try {
    const u = await identity();
    const { id } = await jsonBody(request);
    const integration = await readOne(u.userId, "integrations", id);
    if (!integration || integration.type !== "mcp")
      throw new ApiError("Select an MCP connection.");
    const init = await initializeMcp(integration.endpoint);
    const { result } = await mcpRequest(
      integration.endpoint,
      "tools/list",
      {},
      init.session,
    );
    if (!Array.isArray(result.tools))
      throw new ApiError("The server returned no tool list.", 502);
    const tools = result.tools
      .slice(0, 100)
      .map((t: any) => ({
        name: String(t.name),
        description: String(t.description || ""),
        inputSchema: t.inputSchema,
      }));
    await save(u.userId, "integrations", {
      ...integration,
      tools,
      status: "connected",
    });
    return Response.json({ tools });
  } catch (e) {
    return fail(e);
  }
}
