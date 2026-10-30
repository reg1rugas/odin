import { analyzeScene } from "@/lib/scene-analysis";
import { z } from "zod";
import {
  identity,
  jsonBody,
  fail,
  ApiError,
  readOne,
} from "@/lib/server";
const input = z.object({
  cameraId: z.string().min(1).max(120),
  sessionId: z.string().max(120).optional(),
  image: z.string().max(1500000).optional(),
  frames: z
    .array(
      z.object({
        image: z.string().max(300000),
        at: z.number().finite().min(0),
      }),
    )
    .min(1)
    .max(6)
    .optional(),
  sourceTime: z.number().finite().min(0).optional(),
  prompt: z.string().max(1000).optional(),
});
export async function POST(request: Request) {
  try {
    const u = await identity();
    const parsed = input.safeParse(await jsonBody(request));
    if (!parsed.success) throw new ApiError(parsed.error.issues[0].message);
    const body = parsed.data;
    const camera = await readOne(u.userId, "cameras", body.cameraId);
    if (!camera || camera.source === "demo")
      throw new ApiError(
        "Choose a connected camera. Demo annotations do not use the AI provider.",
      );
    if (!body.frames && !body.image)
      throw new ApiError("Send a frame or a short frame sequence.");
    return Response.json(await analyzeScene(u.userId, camera.id, request, body));
  } catch (e) {
    return fail(e);
  }
}
