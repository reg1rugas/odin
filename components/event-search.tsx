"use client";
import { useState } from "react";
import {
  Search,
  Play,
  User,
  Camera,
  Clock,
  Download,
  ScanFace,
  Trash2,
} from "lucide-react";
import { useOdin } from "./odin-context";
import {
  Button,
  Badge,
  Empty,
  Spinner,
  Modal,
  date,
  time,
  downloadJson,
} from "./common";
import type { Event } from "@/lib/types";
export function EventSearch() {
  const { data, api, notify, navigate, setSeekTo, remove } = useOdin();
  const [query, setQuery] = useState(""),
    [camera, setCamera] = useState(""),
    [person, setPerson] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [events, setEvents] = useState<Event[] | null>(null),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState<{
      url?: string;
      image?: string;
      title: string;
      time: number;
    } | null>(null);
  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    try {
      const p = new URLSearchParams({ q: query, camera, person });
      if (from) p.set("from", String(new Date(from).getTime()));
      if (to) p.set("to", String(new Date(to).getTime()));
      const r = await api(`search?${p}`);
      setEvents(r.events);
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }
  const open = (event: Event) => {
    const camera = data!.cameras.find((c) => c.id === event.cameraId);
    if (camera?.source === "webcam" || !camera) {
      const incident = data!.incidents?.find(i => i.id === event.incidentId);
      const clip = data!.recordings.find(
        (r) =>
          r.cameraId === event.cameraId &&
          (incident ? incident.recordingIds.includes(r.id) : r.sessionId === event.sessionId) &&
          event.sourceTime !== undefined &&
          event.sourceTime >= r.sourceOffset &&
          event.sourceTime <= r.sourceOffset + r.duration,
      );
      setPreview({
        title: event.title,
        url: clip?.url,
        image: event.snapshot,
        time: clip ? Math.max(0, event.sourceTime! - clip.sourceOffset) : 0,
      });
      return;
    }
    if (event.sourceTime !== undefined)
      setSeekTo({ cameraId: event.cameraId, time: event.sourceTime });
    navigate("cameras", event.cameraId);
  };
  return (
    <>
      <section className="surface event-search">
        <div className="panel-title">
          <h2>
            <Search size={17} />
            Search camera history
          </h2>
          <Badge>Across all cameras</Badge>
        </div>
        <form onSubmit={search}>
          <div className="search-input">
            <Search size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search observations, a person, object, or track ID…"
              aria-label="Search history"
            />
          </div>
          <select
            aria-label="Search camera filter"
            value={camera}
            onChange={(e) => setCamera(e.target.value)}
          >
            <option value="">All cameras</option>
            {data!.cameras.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Search enrolled person"
            value={person}
            onChange={(e) => setPerson(e.target.value)}
          >
            <option value="">Any person</option>
            {data!.faces.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            aria-label="History from"
            type="datetime-local"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
          <input
            aria-label="History to"
            type="datetime-local"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? (
              <Spinner text="Searching…" />
            ) : (
              <>
                <Search size={14} />
                Search
              </>
            )}
          </Button>
        </form>
        <p className="search-guidance">
          Person filters connect sightings by an enrolled face match. Unknown
          track IDs apply within one camera only. Results cover recorded
          observations, not unrecorded footage.
        </p>
        {events !== null && (
          <>
            <div className="search-result-heading">
              <span>
                {events.length} observations found
                {events.length === 200 ? " · newest 200 shown" : ""}
              </span>
              <Button
                onClick={() => downloadJson("odin-search-results.json", events)}
              >
                <Download size={13} />
                Export results
              </Button>
            </div>
            {events.length ? (
              <div className="search-result-list">
                {events.map((event) => (
                  <button key={event.id} onClick={() => open(event)}>
                    <div className="search-result-image">
                      {event.snapshot ? (
                        <img src={event.snapshot} alt="Recorded observation" />
                      ) : (
                        <Camera size={22} />
                      )}
                      <Play size={15} />
                    </div>
                    <div>
                      <strong>{event.title}</strong>
                      <p>{event.description}</p>
                      <small>
                        {data!.cameras.find((c) => c.id === event.cameraId)
                          ?.name || "Removed camera"}{" "}
                        · {date(event.timestamp)} {time(event.timestamp)}
                        {event.sourceTime !== undefined
                          ? ` · Clip ${Math.floor(event.sourceTime / 60)}:${String(Math.floor(event.sourceTime % 60)).padStart(2, "0")}`
                          : ""}
                      </small>
                      {event.personName && (
                        <Badge tone="lime">
                          <ScanFace size={11} />
                          {event.personName}
                        </Badge>
                      )}
                      {event.trackId && <Badge>{event.trackId}</Badge>}
                      {event.trackId && <small>{event.observationCount || 1} sightings · first {time(event.firstSeen ?? event.timestamp)} · last {time(event.lastSeen ?? event.timestamp)}</small>}
                    </div>
                    <Badge tone={event.severity}>{event.severity}</Badge>
                  </button>
                ))}
              </div>
            ) : (
              <Empty
                icon={Search}
                title="No matching observations"
                text="Try another keyword, date range, camera, or enrolled person."
              />
            )}
          </>
        )}
        {!!data!.recordings.length && (
          <div className="saved-recordings">
            <h3>Saved camera clips</h3>
            {data!.recordings
              .slice()
              .sort((a, b) => b.startedAt - a.startedAt)
              .map((clip) => (
                <div key={clip.id}>
                  <span>
                    <strong>{clip.name}</strong>
                    <small>
                      {date(clip.startedAt)} {time(clip.startedAt)} ·{" "}
                      {Math.round(clip.duration)} seconds
                    </small>
                  </span>
                  <Button
                    onClick={() =>
                      setPreview({ title: clip.name, url: clip.url, time: 0 })
                    }
                  >
                    <Play size={13} />
                    Watch clip
                  </Button>
                  <a
                    className="btn"
                    href={clip.url}
                    download={`odin-${clip.id}.webm`}
                  >
                    Download
                  </a>
                  <Button
                    variant="danger"
                    title="Delete saved clip"
                    onClick={async () => {
                      if (!confirm("Delete this saved video clip?")) return;
                      try {
                        await remove("recordings", clip.id);
                        notify("Clip deleted");
                      } catch (e) {
                        notify((e as Error).message, "error");
                      }
                    }}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}
          </div>
        )}
      </section>
      {preview && (
        <Modal title={preview.title} onClose={() => setPreview(null)} wide>
          {preview.url ? (
            <video
              className="archive-video"
              src={preview.url}
              controls
              autoPlay
              playsInline
              onLoadedMetadata={(e) => {
                e.currentTarget.currentTime = preview.time;
              }}
            />
          ) : (
            <>
              <p className="muted">
                No video clip was saved for this observation.
              </p>
              {preview.image && (
                <img
                  className="archive-video"
                  src={preview.image}
                  alt="Recorded observation"
                />
              )}
            </>
          )}
        </Modal>
      )}
    </>
  );
}
