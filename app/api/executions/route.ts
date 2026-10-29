import { executionStatus } from "@/lib/workflow-engine";
import {
  identity,
  jsonBody,
  fail,
  ApiError,
  readOne,
  save,
} from "@/lib/server";
export async function PATCH(request: Request) {
  try {
    const u = await identity();
    const { id, nodeId, status, message } = await jsonBody(request);
    const ex = await readOne(u.userId, "executions", id);
    if (!ex || !["success", "failed"].includes(status))
      throw new ApiError("Execution not found.", 404);
    const result = ex.results.find(
      (r: any) => r.nodeId === nodeId && r.status === "pending",
    );
    if (!result) throw new ApiError("No pending browser delivery.");
    result.status = status;
    result.message = String(message).slice(0, 500);
    ex.status = executionStatus(ex.results);
    await save(u.userId, "executions", ex);
    return Response.json({ execution: ex });
  } catch (e) {
    return fail(e);
  }
}
