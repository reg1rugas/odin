import {
  identity,
  jsonBody,
  fail,
  ApiError,
  gemini,
  secret,
  readAll,
} from "@/lib/server";
import { workflowSchema } from "@/lib/validation";
export async function POST(request: Request) {
  try {
    const u = await identity();
    const { prompt, cameraId } = await jsonBody(request);
    if (typeof prompt !== "string" || prompt.length < 5 || prompt.length > 3000)
      throw new ApiError("Describe a workflow in 5–3,000 characters.");
    const cameras = await readAll(u.userId, "cameras");
    const camera = cameras.find((c) => c.id === cameraId) || cameras[0];
    if (!camera) throw new ApiError("Add a camera first.");
    const id = crypto.randomUUID();
    let flow: any;
    const ai = !!(
      request.headers.get("x-odin-ai-key") || secret("GEMINI_API_KEY")
    );
    if (ai) {
      flow = await gemini(
        u.userId,
        `Create a JSON camera workflow from the user description. Output {name,description,nodes,edges}. Node format: {id,type:'input'|'rule'|'action',title,description,x,y,cameraId?,detectionClass?,ruleMode?:'object'|'semantic',action?,destination?,cooldown?}. Edge format {id,source,target}. Include input node with cameraId '${camera.id}' at x:60,y:150; rules x:360; actions x:680. Supported classes: person,car,backpack,handbag,dog,cat,truck,bicycle,unknown_face,known_face,motion,* . Actions: browser,voice,email,sms,call,webhook,mcp. Never invent destination addresses, credentials or integrations. Default to browser action if no destination specified. Use ruleMode object for exact object classes. Use ruleMode semantic for visible scene conditions such as an unattended bag or a physical struggle; these are evaluated against short frame sequences by AI. Semantic rules require continuous or manual AI analysis. Time schedules are not supported. Do not claim time restrictions are enforced. Keep description honest about implemented rule. User description: ${prompt}`,
        request,
        undefined,
        true,
      );
    } else {
      const lower = prompt.toLowerCase();
      const cls = lower.includes("bag")
        ? "backpack"
        : lower.includes("vehicle") || lower.includes("car")
          ? "car"
          : lower.includes("dog")
            ? "dog"
            : lower.includes("cat")
              ? "cat"
              : lower.includes("motion")
                ? "motion"
                : lower.includes("unknown")
                  ? "unknown_face"
                  : "person";
      const semantic =
        /fight|steal|unattend|fall|loiter|struggle|pick.*up|left.*bag/i.test(
          prompt,
        );
      flow = {
        name: `${cls.charAt(0).toUpperCase() + cls.slice(1)} detection`,
        description: semantic
          ? "AI scene rule draft. Connect an AI provider and enable scene analysis to evaluate this condition."
          : `Detect ${cls} and notify in the browser. Generated from a detection template.`,
        nodes: [
          {
            id: "input",
            type: "input",
            title: "Camera input",
            description: camera.name,
            cameraId: camera.id,
            x: 60,
            y: 150,
          },
          {
            id: "rule",
            type: "rule",
            title: `Detect ${cls}`,
            description: prompt,
            detectionClass: cls,
            ruleMode: semantic ? "semantic" : "object",
            x: 360,
            y: 150,
          },
          {
            id: "action",
            type: "action",
            title: lower.includes("voice")
              ? "Voice announcement"
              : "Browser notification",
            description: "Notify the operator",
            action: lower.includes("voice") ? "voice" : "browser",
            cooldown: 60,
            x: 680,
            y: 150,
          },
        ],
        edges: [
          { id: "e1", source: "input", target: "rule" },
          { id: "e2", source: "rule", target: "action" },
        ],
      };
    }
    const result = workflowSchema.safeParse({
      ...flow,
      id,
      enabled: false,
      createdAt: Date.now(),
    });
    if (!result.success)
      throw new ApiError(
        "The generated graph could not be validated. Try a simpler description.",
        502,
      );
    return Response.json({
      workflow: result.data,
      mode: ai ? "ai" : "template",
    });
  } catch (e) {
    return fail(e);
  }
}
