import {
  identity,
  jsonBody,
  fail,
  ApiError,
  readAll,
  save,
} from "@/lib/server";
import type { Event, Report } from "@/lib/types";
export async function POST(request: Request) {
  try {
    const u = await identity();
    const { title, from, to, cameraIds } = await jsonBody(request);
    if (
      typeof title !== "string" ||
      !title.trim() ||
      title.length > 160 ||
      !Number.isFinite(from) ||
      !Number.isFinite(to) ||
      from >= to ||
      !Array.isArray(cameraIds)
    )
      throw new ApiError("Enter a title and valid date range.");
    const events = (await readAll<Event>(u.userId, "events")).filter(
      (e) =>
        e.timestamp >= from &&
        e.timestamp <= to &&
        (!cameraIds.length || cameraIds.includes(e.cameraId)),
    );
    const critical = events.filter((e) => e.severity === "critical").length;
    const warnings = events.filter((e) => e.severity === "warning").length;
    const samples = events.filter((e) => e.demo).length;
    const report: Report = {
      id: crypto.randomUUID(),
      title: title.trim(),
      from,
      to,
      cameraIds,
      createdAt: Date.now(),
      eventCount: events.length,
      summary: `${events.length} events recorded: ${critical} critical, ${warnings} warnings, and ${events.length - critical - warnings} informational. ${events.filter((e) => !e.acknowledged).length} events await review. ${samples ? `${samples} events are labeled sample data.` : "All events are from connected sources."}`,
    };
    await save(u.userId, "reports", { ...report, events });
    return Response.json({ report });
  } catch (e) {
    return fail(e);
  }
}
