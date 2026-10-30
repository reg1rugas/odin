# Local perception and selective incident analysis

Implemented in the current checkout:

- Stronger supported COCO-SSD backbone; 60-object limit, optional overlapping crop passes, class-aware duplicate suppression, all 80 COCO classes in the workflow builder.
- Existing camera-local tracks retain positions, movement direction and relative frame speed; one batched update per scan avoids a separate request/refresh for every object. Tracks reset on backward seeks, loops, and new capture sessions.
- Spatial workflows submit each scan (with movement deltas), and short-term motion association helps retain IDs when boxes stop overlapping. Server evaluates polygon entry/exit, finite directional line crossings, and continuous dwell from sampled positions. The visual builder previews the camera's latest available snapshot; saving a node persists the workflow. The live viewer draws active regions and object centers. Tracks and geometry are approximate; dwell resets across observation gaps longer than ten seconds. Zone exits require an observed position outside; disappearance alone is not proof of exit. No physical speed or ownership inference.
- Optional silent, five-FPS video buffer in both viewers. Five-second independently playable segments preserve about ten seconds before activity after warmup and 10–30 seconds after, with a maximum of eight segments. Pause/seek/capture gaps reset evidence. Stopping monitoring discards unfinished incident buffers; existing optional archival recording retains its own stop behavior.
- New tracks, movement, loss of a track, sustained pixel changes, local rule matches, and ten-minute context checks can propose incidents. Nearby triggers merge; upload memory is bounded. A buffer cannot capture all activity while its previous incident awaits analysis, during cooldowns, or when the browser is throttled.
- Private clip upload, authentication and ownership checks, chronological/size/type limits, atomic incident-ID reservation, and an atomic per-camera hourly allowance. Repeated incident IDs cannot execute analysis twice. Defaults allow 12 automatic analyses per camera per clock hour, with client spacing; this is a request allowance, not a financial cap. Manual analysis is separate.
- Shared scene analysis for existing frames and new video. Only allowlisted semantic rule IDs can trigger semantic actions. Incomplete provider output fails verification. Local observations are supplied as context rather than instructions.
- Bounded transient retries, optional configurable Gemini fallback, and reported input/output/thinking/total token records. Usage records omit credentials and footage. Failed or unreported usage may be absent.
- Camera views retain recent workflow results; disabled browser delivery is surfaced, and spatial cooldown suppression is recorded as skipped.
- Incident history with state, reason, selected model, reported usage, and sequential segment playback. Existing R2 recording retention applies; camera deletion removes incident records. No database schema migration is needed because records remain JSON-backed.

## Try it

1. Reload/restart the local app. In Intelligence, select Balanced or Detail, adjust confidence (45–55% is a useful starting range), set the automatic hourly allowance, and save settings.
2. Start a connected camera and enable object detection. To use local geometry rules, open a workflow rule, select Local zone/line/dwell, choose a supported class, draw the region, connect the action, save and enable the workflow.
3. Configure Gemini, then enable Incident clips (or multi-camera scene analysis). R2 storage and a browser supporting canvas capture and MediaRecorder WebM/MP4 are required. The microphone is never requested for incident capture.
4. Allow the buffer to warm up. Introduce a person/object or cross the configured region. Inspect Activity → Incident analysis for evidence and results. Local rule actions do not wait for Gemini.
5. Check reported token counts before increasing the hourly allowance. Lower-resolution clips and selective uploads reduce the amount submitted, but actual provider usage depends on model processing and thinking.

## Validation and next work

Workflow alerts are linked to their source event and displayed in event details with action delivery results. New executions retain camera, track, session, incident, origin, and trigger video time even when the tracked event advances. Camera chat reads up to 20 recent scoped alerts; scene analysis reads up to 8 alongside recent observations. Both prompts distinguish rule matches and delivery status from independent visual confirmation. Existing executions are associated through their source event when camera metadata is absent. No duplicate detection events or additional Gemini requests are created for this context.

Automated tests cover track aggregation, geometry, crop-result merging, recording lifecycle and pre/post timing with mocked browser APIs, retry limits and token accounting, and the incident upload route against SQLite with mocked R2/Gemini. They do not establish detector accuracy or real codec/provider compatibility.

Still needed before treating this as production monitoring:

- Real-browser camera and uploaded-footage trials on target hardware, checking missed objects, false positives, track swaps, recording compatibility, latency, and token bills. Real MediaRecorder encoding and Gemini video requests were not exercised by mocked tests.
- A labeled footage evaluation set and an explicit recall/false-alert target before considering a different model family or additional model downloads.
- Optional local pose estimation, stationary-object/person-separation candidate logic, and movement/occupancy summaries. Generic triggers are currently broader and can miss subtle semantic incidents.
- More complete incident lifecycle recovery: retry UI for failed analyses, unfinished capture recovery, and recording every event while an earlier analysis is in flight.
- Accurate monetary estimates based on versioned model pricing and recorded bills, rather than equating request count with spend.
- Persistent capture outside the browser, continuous archival recording, and calibrated physical distance/speed are separate infrastructure work. No cross-camera unknown-person re-identification is provided.
