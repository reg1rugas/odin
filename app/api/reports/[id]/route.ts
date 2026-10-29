import { identity, fail, ApiError, readOne } from "@/lib/server";
import { makePdf } from "@/lib/pdf";
import type { Event } from "@/lib/types";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const u = await identity();
    const { id } = await params;
    const report = await readOne(u.userId, "reports", id);
    if (!report) throw new ApiError("Report not found.", 404);
    const bytes = makePdf(report.title, [
      `Period: ${new Date(report.from).toISOString()} to ${new Date(report.to).toISOString()}`,
      "",
      report.summary,
      "",
      "EVENT TIMELINE",
      "",
      ...(report.events || []).flatMap((e: Event) => [
        `${e.demo ? "[SAMPLE] " : ""}${new Date(e.timestamp).toISOString()} | ${e.severity.toUpperCase()} | ${e.title}`,
        `${e.description} Confidence: ${Math.round(e.confidence * 100)}%. Status: ${e.acknowledged ? "Reviewed" : "Awaiting review"}`,
        "",
      ]),
    ]);
    return new Response(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="odin-report-${id}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return fail(e);
  }
}
