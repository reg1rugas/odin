# Odin — Visual Intelligence

Odin is a full-stack camera monitoring workspace with browser-based perception, persistent event history, visual automation, camera chat, and PDF reporting.

## Quick start

Requires **Node.js 22.13+**, npm, Git, and a modern browser with WebGL. Node.js 22 is pinned in `.nvmrc` for nvm users.

```sh
git clone https://github.com/reg1rugas/odin.git
cd odin
npm ci
npm run build
npm run db:migrate
npm run dev
```

Open **http://localhost:5173** and choose **Sign in to Odin**. Run the commands from the cloned repository root, where `package.json` lives. The first build generates framework types and the local Worker configuration; migrations initialize the local D1 database. No Cloudflare account or provider API key is needed for local object, face, and motion detection.

Local development uses a loopback-only test identity. Use `localhost` or `127.0.0.1` directly; opening the app through a LAN address does not enable local sign-in. Production uses hosted ChatGPT sign-in and a private site access policy.

The first sign-in creates six playable demonstration cameras, sample events, and paused workflow templates. Demonstration clips have explicitly scripted playback annotations; they do not call AI or send external actions. The public introduction is at `/welcome`.

### Try a real detection

1. Add a webcam, upload a video, or add a CORS-enabled HTTPS video URL.
2. Open the camera, enable object detection, and select **Start monitoring**. Allow camera access for a webcam and wait for the model download.
3. Create a workflow connecting that camera to an **On-device object class** rule for `person`, then a browser notification action.
4. Save and activate the workflow. Enable browser notifications in Settings and grant browser permission.
5. Move into view and inspect the resulting event and workflow execution. An action cooldown prevents repeated alerts for at least 30 seconds.

For zone-based automation, choose **Local zone, line crossing, or dwell time** and draw the region on the camera preview.

### Optional credentials

To enable Gemini or external notification providers, create a local configuration file:

```sh
cp .dev.vars.example .dev.vars
```

On Windows PowerShell, use `Copy-Item .dev.vars.example .dev.vars`. Fill only the values for providers you use, then restart the development server. A Gemini key can also be entered for the current tab under **Settings → Intelligence**. The variable reference is below. `.dev.vars` is ignored by Git.

### Common setup issues

| Symptom | What to check |
| --- | --- |
| Missing framework types or `dist/server/wrangler.json` | Run `npm run build` before type checking or using `npm start`. |
| Missing database tables | Stop the dev server, run `npm run db:migrate` from the repository root, then restart it. |
| Local sign-in fails | Open `http://localhost:5173` directly. The production authentication flow requires the original hosting integration. |
| Camera is unavailable | Use localhost or HTTPS, grant camera permission, and close other applications using the camera. |
| Detection model fails to load | Check internet access, WebGL support, and whether the browser blocks the model/CDN requests. |
| A video plays but cannot be analyzed | Remote video hosts must allow CORS for pixel access; try a local upload instead. |
| Gemini returns a model or quota error | Select a Gemini model available to your API project in Settings and check the provider's quota. Local detection works independently. |

Local records and media remain under ignored `.wrangler/state`. Keep that directory to retain your local workspace between runs.

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
- Exact object-class, drawn zone entry/exit, line-crossing and dwell-time rules, plus AI scene-description verification; per-action cooldowns and persisted delivery logs.
- Timestamped video events beside playback, matching workflow node/edge highlights, and a workflow executor panel.
- Browser notifications and speech synthesis while a monitoring tab is active.
- Server integrations for Resend email, Twilio SMS, Vapi calls, Slack/Discord/general webhooks, and Streamable HTTP MCP tools.
- MCP tool discovery, input schema inspection, and JSON tool arguments with `{{message}}` substitution.
- Camera chat grounded in selected cameras and their event history. Without Gemini, it explicitly returns an event summary.
- Manual Gemini analysis of up to six timestamped frames; optional activity-triggered video incidents with a rolling pre-buffer, periodic context checks, token accounting, and an hourly request limit. Camera chat and workflow generation also use Gemini.
- Analytics calculated from actual stored events and executions, with date-range filtering and data export.
- Date/camera-filtered PDF reports generated on the server. Reports retain their event snapshot.
- Account-scoped D1 records and media, signed-in APIs, private hosting, and session-only Gemini keys.

## Provider setup

The default AI model is `gemini-3.8-flash`. Change it in **Settings → Intelligence → Gemini model**, then select **Apply model** (or **Save changes** to save all settings). The saved model is displayed below the field. Explicit Gemini selections are preserved when the workspace loads; invalid or non-Gemini saved values fall back to the default. Model availability depends on your API project; select a model your key can access.

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

Enable **Incident clips** in a camera viewer (or scene analysis in multi-camera monitoring) to buffer silent video locally at up to 640 pixels wide and 5 FPS. Independent five-second segments retain approximately ten seconds of pre-trigger footage after warmup. New tracks, significant track displacement, track disappearance, sustained scene motion, or a matched local workflow rule can collect another 10–30 seconds of activity, capped at eight segments. Nearby triggers merge; uploads are serialized, spaced according to the configured allowance, and capped by the server per camera per clock hour (12 by default). A context check is attempted every ten minutes. Manual sequence analysis retains its separate 20-second cooldown and six-frame input limit.

Incident evidence is uploaded to private R2 storage and sent to Gemini only when analysis is enabled. Activity history shows pending, verified, uncertain, failed, and budget-skipped results, playback segments, selected model, and reported token counts. Verified means an enabled semantic rule matched; it is not a guarantee that every observation is correct. Provider service errors receive at most two retries; an optional fallback model applies to temporary HTTP service failures, not bad keys or exhausted quotas. Token totals cover retained, loaded usage records and do not include usage the provider did not report. A request allowance is not a dollar spending cap. Retries/fallbacks can produce additional provider calls.

The local detector now uses COCO-SSD MobileNet V2 (80 supported categories), up to 60 detections per scan. **Settings → Intelligence → Detection detail** enables four additional overlapping crop passes for smaller objects; this costs browser processing time. New workspaces use 50% confidence; existing thresholds are preserved. Lowering confidence can improve recall and increase false positives. No category coverage or accuracy guarantee is implied.

Known face matches use the same enrolled person ID across cameras, enabling a searchable sightings trail. Matches are approximate and should be verified. Unknown object track IDs are geometric associations within one camera and capture session; they do not identify a person across different cameras or re-establish identity after a long absence. General appearance-based cross-camera re-identification is not implemented.

Single-camera inference runs while its viewer is open. Multi-camera sessions remain active across app pages while the tab stays open; browser throttling and device limits can reduce throughput. Closing or reloading the tab stops capture and analysis. This is not a background NVR or a server-side RTSP ingest service. RTSP cameras require a browser-compatible gateway. Webcam capture needs localhost or HTTPS. Browser video URL sources must permit CORS for pixel access. Video uploads support MP4, WebM, and Ogg up to 50 MB.

History search queries retained database events directly and returns the newest 200 matches. It is a keyword/filter search, not an embedding search over every raw frame. Ordinary workspace views load up to 2,000 recent records per kind. The chat uses the newest 80 selected-camera observations and explicitly falls back to a summary without a key. Saved webcam segments are approximately 30 seconds; upload time can create gaps between segments. This is not a continuous archival recorder.

## Architecture

- **UI:** React 19, TypeScript, Vinext/Vite, Lucide icons, Recharts.
- **Server:** Cloudflare Worker with authenticated application routes.
- **Database:** D1 records partitioned by authenticated owner and record kind, with a unique owner/kind/id index.
- **Files:** R2, with object keys partitioned by owner and authenticated media routes.
- **Perception:** Pinned, lazy-loaded browser models; no frame upload for local inference.
- **Reasoning:** Gemini REST requests from the server. Frames are shared on explicit analysis; incident video is shared only while automatic incident analysis is enabled.
- **Automation:** Server graph traversal, exact-class and scoped semantic rule evaluation, atomic cooldown claims, provider calls, and browser delivery acknowledgments.

## Tracked detection history

Local person/object sightings update one event per camera-local track instead of creating a new event on each heartbeat. Records include first/last seen, detector observation count, latest normalized position, and up to 120 recent movement samples, visible in event details and JSON exports. Track updates normally use five-second heartbeats; cameras with enabled spatial workflows submit each detection scan and send only new movement samples; the last recorded sighting is not a confirmed departure time. Existing history is retained. Face and motion events remain separate. Workflow evaluation runs on track updates and retains action cooldowns. Spatial matches suppressed by cooldown are recorded as skipped, and camera views show recent workflow results and active geometry. Saving a node also persists its workflow. Track IDs do not establish identity across cameras or after tracking is lost.

## Validation

```sh
npm test
npm run typecheck
npm run build
npm run db:migrate
```

Schema changes are defined in `db/schema.ts`. Generate new migrations with `npm run db:generate`; do not edit migrations that have already been applied. Hosted migrations are applied during publication. Local state is under ignored `.wrangler/state`.

The source is in this `odin/` directory. `.openai/hosting.json` retains the private deployment identity and storage bindings; preserve it when updating the deployed site.


## Repository layout

| Path | Contents |
| --- | --- |
| `app/` | Application pages and server API routes |
| `components/` | Camera views, monitoring, workflows, search, and analytics |
| `lib/` | Detection, tracking, workflow evaluation, provider clients, and reporting |
| `db/` and `drizzle/` | Database schema and versioned migrations |
| `public/demo/` | Sample footage and thumbnails |
| `tests/core.test.mjs` | Core logic and mocked integration tests |
| `scripts/` | Portable build, local database, and runtime helpers |

## Deployment and GitHub publication

GitHub hosts the source code. GitHub Pages cannot run this application's Worker APIs, D1 database, or R2 storage. Production deployment currently depends on the original hosting integration for authentication and storage bindings; cloning the repository does not provision that environment.

See [the GitHub publishing guide](docs/GITHUB.md) for repository publication commands. Automated GitHub checks install the locked dependencies, build the application, run tests and TypeScript checks, and apply migrations to a local database. They do not use production credentials or deploy the application.
