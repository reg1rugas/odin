# Odin — Visual Intelligence

Odin is a full-stack camera monitoring workspace with browser-based perception, persistent event history, visual automation, camera chat, and PDF reporting.

## Run locally

Requires Node.js 22.13+ and npm.

```sh
cd odin
npm install
npm run build
npm run db:migrate
npm run dev
```

Open http://localhost:5173 and choose **Sign in to Odin**. Local development uses the starter's loopback-only test identity. Production uses hosted ChatGPT sign-in and a private site access policy.

The first sign-in creates six clearly labeled sample camera previews, sample events, and two paused workflow templates. These previews are still images, and sample events never trigger external actions. Add a webcam, a video file, or a public HTTPS video URL to monitor real activity.

## What works

- Camera creation, editing, deletion, category filters, search, and grid/list layouts.
- Private video uploads to R2, playback, authenticated byte-range streaming, and media deletion.
- Device webcam monitoring, snapshots, and downloadable webcam recordings.
- On-device COCO-SSD object detection, Human face embeddings and matching, and pixel-difference motion detection.
- Face enrollment from portraits, private embedding storage, and enrollment removal.
- Timestamped events, confidence values, severity, acknowledgment, JSON export, and retention.
- A central Triggers view for inspecting and updating detection rules.
- Draggable workflow nodes, connection editing, graph validation, pause/activate controls, duplication, rename, deletion, and JSON import/export.
- Natural-language workflow drafts, browser speech-to-text input, and tool suggestions using `@` in action descriptions.
- Exact detection-class rules, per-action cooldown claims, and persisted execution/delivery logs.
- Browser notifications and speech synthesis while a monitoring tab is active.
- Server integrations for Resend email, Twilio SMS, Vapi calls, Slack/Discord/general webhooks, and Streamable HTTP MCP tools.
- MCP tool discovery, input schema inspection, and JSON tool arguments with `{{message}}` substitution.
- Camera chat grounded in selected cameras and their event history. Without Gemini, it explicitly returns an event summary.
- Gemini frame analysis, periodic visual analysis, conversational answers, and workflow generation when a key is supplied.
- Analytics calculated from actual stored events and executions, with date-range filtering and data export.
- Date/camera-filtered PDF reports generated on the server. Reports retain their event snapshot.
- Account-scoped D1 records and media, signed-in APIs, private hosting, and session-only Gemini keys.

## Provider setup

The default AI model is `gemini-3.8-flash`. You can change it in **Settings → Intelligence → Gemini model**. Existing workspaces using the previous `gemini-2.5-flash` default are upgraded when loaded; custom model selections are preserved. Google restricts Gemini 2.5 models to previously active users, so they are unsuitable defaults for new API projects. Model availability also depends on your API key's project access.

Object, face, and motion detection do not require an API key. The first use downloads the pinned browser libraries and model weights from their public hosts; internet access and a WebGL-capable browser are needed. Model loading errors appear in the viewer.

A Gemini key can be entered in **Settings → Intelligence**. It stays in the React state of the current tab and is sent only to the same-origin backend; it is not saved to local storage, D1, source files, or logs. Alternatively, configure server runtime variables:

| Variable               | Purpose                                               |
| ---------------------- | ----------------------------------------------------- |
| `GEMINI_API_KEY`       | Gemini scene reasoning, workflow generation, and chat |
| `RESEND_API_KEY`       | Resend email delivery                                 |
| `ALERT_FROM_EMAIL`     | A verified Resend sender                              |
| `TWILIO_ACCOUNT_SID`   | Twilio account                                        |
| `TWILIO_AUTH_TOKEN`    | Twilio authentication                                 |
| `TWILIO_FROM_NUMBER`   | Twilio SMS sender in E.164 format                     |
| `VAPI_API_KEY`         | Vapi private API key                                  |
| `VAPI_PHONE_NUMBER_ID` | Vapi outbound phone number identifier                 |
| `MCP_BEARER_TOKEN`     | Optional bearer credential for configured MCP servers |

For local development, copy `.dev.vars.example` to `.dev.vars` and fill only the values you use. `.dev.vars` is ignored by Git. For hosted deployments, configure these values through the hosting platform's runtime secret controls and redeploy. Never put credentials in the hosting manifest or frontend files.

Webhook URLs are configured in **Integrations** and stored in the private workspace. Provider credentials are never returned by the workspace API. An action with missing configuration records a failure rather than claiming delivery succeeded. Provider acceptance does not guarantee final email, SMS, or call delivery.

## Monitoring and automation

1. Add a webcam, upload a video, or add a CORS-enabled HTTPS MP4/WebM URL.
2. Open the camera and select **Start monitoring**.
3. Enable object, face, or motion detection as needed. Enroll portraits first to recognize familiar faces.
4. Create a workflow and connect a camera input to a detection rule, then to an action.
5. Save and activate the workflow. Browser/voice permissions and preferences are under Settings.
6. Detections create events, invoke matching active workflows, and populate execution history.

Each detection class is recorded at most once per 30 seconds per viewer, and each action has a server-enforced cooldown of at least 30 seconds. Rules match the selected class exactly. Descriptive text is explanatory; time schedules, arbitrary natural-language conditions, and medical diagnoses are not inferred or silently enforced. Gemini analysis can create additional observation events, but results should be verified.

Monitoring and inference run while the viewer is open. Closing the tab stops camera capture and analysis. This is not a background NVR or a server-side RTSP ingest service. RTSP cameras require a browser-compatible gateway. Webcam capture needs localhost or HTTPS. Browser video URL sources must permit CORS for pixel access. Video uploads support MP4, WebM, and Ogg up to 50 MB.

## Architecture

- **UI:** React 19, TypeScript, Vinext/Vite, Lucide icons, Recharts.
- **Server:** Cloudflare Worker with authenticated application routes.
- **Database:** D1 records partitioned by authenticated owner and record kind, with a unique owner/kind/id index.
- **Files:** R2, with object keys partitioned by owner and authenticated media routes.
- **Perception:** Pinned, lazy-loaded browser models; no frame upload for local inference.
- **Reasoning:** Gemini REST requests from the server. Frame sharing happens only on explicit frame analysis or enabled periodic analysis.
- **Automation:** Server graph traversal, exact-class rule evaluation, atomic cooldown claims, provider calls, and browser delivery acknowledgments.

## Validation

```sh
npm test
npm run typecheck
npm run build
npm run db:migrate
```

Schema changes are defined in `db/schema.ts`. Generate new migrations with `npm run db:generate`; do not edit migrations that have already been applied. Hosted migrations are applied during publication. Local state is under ignored `.wrangler/state`.

The source is in this `odin/` directory. `.openai/hosting.json` retains the private deployment identity and storage bindings; preserve it when updating the deployed site.
