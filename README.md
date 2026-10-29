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

The first sign-in creates six playable demonstration cameras, sample events, and paused workflow templates. Demonstration clips have explicitly scripted playback annotations; they do not call AI or send external actions. Existing built-in still previews upgrade automatically. The public introduction is at `/welcome`. Add a webcam, a video file, or a public HTTPS video URL to monitor real activity.

## What works

- Three-column camera dashboard with playable previews, camera creation, editing, deletion, and search.
- Private video uploads to R2, playback, authenticated byte-range streaming, and media deletion.
- Device webcam monitoring, snapshots, and downloadable webcam recordings.
- Persistent browser monitoring of up to four connected feeds across app pages, with optional saved webcam segments in R2 and historical playback.
- Camera-local geometric object tracks and enrolled-face sightings across cameras.
- Database history search by text, camera, enrolled person, and date range, with source timestamps and JSON export.
- On-device COCO-SSD object detection, Human face embeddings and matching, and pixel-difference motion detection.
- Face enrollment from portraits, private embedding storage, and enrollment removal.
- Timestamped events, confidence values, severity, acknowledgment, JSON export, and retention.
- A central Triggers view for inspecting and updating detection rules.
- Draggable workflow nodes, connection editing, graph validation, pause/activate controls, duplication, rename, deletion, and JSON import/export.
- Natural-language workflow drafts, browser speech-to-text input, and tool suggestions using `@` in action descriptions.
- Exact object-class rules and AI scene-description rules, per-action cooldown claims, and persisted execution/delivery logs.
- Timestamped video events beside playback, matching workflow node/edge highlights, and a workflow executor panel.
- Browser notifications and speech synthesis while a monitoring tab is active.
- Server integrations for Resend email, Twilio SMS, Vapi calls, Slack/Discord/general webhooks, and Streamable HTTP MCP tools.
- MCP tool discovery, input schema inspection, and JSON tool arguments with `{{message}}` substitution.
- Camera chat grounded in selected cameras and their event history. Without Gemini, it explicitly returns an event summary.
- Gemini analysis of up to six timestamped frames, optional periodic scene analysis, conversational answers, and workflow generation when a key is supplied.
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

Local events are deduplicated for 30 seconds by class and person/track within each capture session. Each action has a server-enforced cooldown of at least 30 seconds. Choose **On-device object class** for exact object matching, or **AI scene description** for a visible condition evaluated from sampled frames. Scene rules require configured AI and enabled analysis. A local person detection alone cannot satisfy a semantic rule; AI must return the allowed workflow-scoped rule ID. Descriptions cannot enforce time schedules or establish intent, and model observations require verification.

For multiple feeds, choose **Monitor cameras** from the dashboard. Select up to four feeds and optionally enable face recognition, scene analysis, or saved webcam clips. Capture continues when navigating within Odin. **Stop all monitoring** releases the cameras; it also saves the final partial clip. View, download, or delete saved clips in **History & Search**. Removing a camera removes its observations and saved clips. Clips follow the configured retention window.

Scene analysis defaults to 60-second intervals and sends at most six recent sampled frames, not every video frame. One cloud analysis runs per browser tab, requests are spaced by at least 20 seconds, and quota errors impose a 60-second cooldown. Busy feeds may skip a cycle. This reduces free-tier pressure but cannot bypass provider quotas or guarantee detection of short events. Object detection continues locally without cloud credits.

Known face matches use the same enrolled person ID across cameras, enabling a searchable sightings trail. Matches are approximate and should be verified. Unknown object track IDs are geometric associations within one camera and capture session; they do not identify a person across different cameras or re-establish identity after a long absence. General appearance-based cross-camera re-identification is not implemented.

Single-camera inference runs while its viewer is open. Multi-camera sessions remain active across app pages while the tab stays open; browser throttling and device limits can reduce throughput. Closing or reloading the tab stops capture and analysis. This is not a background NVR or a server-side RTSP ingest service. RTSP cameras require a browser-compatible gateway. Webcam capture needs localhost or HTTPS. Browser video URL sources must permit CORS for pixel access. Video uploads support MP4, WebM, and Ogg up to 50 MB.

History search queries retained database events directly and returns the newest 200 matches. It is a keyword/filter search, not an embedding search over every raw frame. Ordinary workspace views load up to 2,000 recent records per kind. The chat uses the newest 80 selected-camera observations and explicitly falls back to a summary without a key. Saved webcam segments are approximately 30 seconds; upload time can create gaps between segments. This is not a continuous archival recorder.

## Architecture

- **UI:** React 19, TypeScript, Vinext/Vite, Lucide icons, Recharts.
- **Server:** Cloudflare Worker with authenticated application routes.
- **Database:** D1 records partitioned by authenticated owner and record kind, with a unique owner/kind/id index.
- **Files:** R2, with object keys partitioned by owner and authenticated media routes.
- **Perception:** Pinned, lazy-loaded browser models; no frame upload for local inference.
- **Reasoning:** Gemini REST requests from the server. Frame sharing happens only on explicit frame analysis or enabled periodic analysis.
- **Automation:** Server graph traversal, exact-class and scoped semantic rule evaluation, atomic cooldown claims, provider calls, and browser delivery acknowledgments.

## Validation

```sh
npm test
npm run typecheck
npm run build
npm run db:migrate
```

Schema changes are defined in `db/schema.ts`. Generate new migrations with `npm run db:generate`; do not edit migrations that have already been applied. Hosted migrations are applied during publication. Local state is under ignored `.wrangler/state`.

The source is in this `odin/` directory. `.openai/hosting.json` retains the private deployment identity and storage bindings; preserve it when updating the deployed site.
