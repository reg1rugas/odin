"use client";
import { useState } from "react";
import { useOdin } from "./odin-context";
import { Badge, Modal, time, date, Button } from "./common";
import type { Incident } from "@/lib/types";
export function IncidentHistory() {
  const {data} = useOdin();
  const [selected, setSelected] = useState<Incident | null>(null), [part, setPart] = useState(0);
  const incidents = [...(data?.incidents || [])].sort((a,b) => b.timestamp - a.timestamp).slice(0,50);
  const usage = data?.ai_usage || [];
  const clips = selected?.recordingIds.map(id => data?.recordings.find(r => r.id === id)).filter(r => !!r) || [];
  return <section className="surface" style={{padding: 20, marginBottom: 20}}>
    <div className="panel-title"><div><h2>Incident analysis</h2><p>Local activity selects the evidence sent to Gemini. Automatic limit: {data?.settings.aiChecksPerHour ?? 12} analyses per camera per hour.</p></div></div>
    <p>Verified means an enabled AI scene rule matched. Uncertain means no such rule was confirmed. Failed analyses never verify rules.</p>
    <p>{usage.reduce((n,u) => n + u.totalTokens,0).toLocaleString()} recorded AI tokens · {usage.reduce((n,u) => n + u.thinkingTokens,0).toLocaleString()} thinking tokens · {usage.length} retained usage records. Totals cover loaded history and exclude unreported/failed-request usage.</p>
    {!incidents.length && <p>Enable Incident clips in a camera viewer, or scene analysis in multi-camera monitoring, to collect activity clips. No clips are uploaded while this is off.</p>}
    {incidents.map(incident => <div key={incident.id} className="trigger-row">
      <div><strong>{data?.cameras.find(c => c.id === incident.cameraId)?.name || "Removed camera"} · {incident.reason}</strong><p>{incident.summary}</p><small>{date(incident.timestamp)} {time(incident.timestamp)}{incident.model ? ` · ${incident.model}` : ""} · {usage.filter(u => u.incidentId === incident.id).reduce((n,u) => n+u.totalTokens,0).toLocaleString()} reported tokens</small></div>
      <Badge tone={incident.status === "verified" ? "lime" : incident.status === "failed" ? "critical" : "neutral"}>{incident.status}</Badge>
      {!!incident.recordingIds.length && <Button onClick={() => {setSelected(incident); setPart(0);}}>View evidence</Button>}
    </div>)}
    {selected && <Modal title="Incident evidence" subtitle={`${selected.reason} · ${selected.status}`} onClose={() => setSelected(null)} wide>
      <p>{selected.summary}</p>
      {clips.length ? <>
        <p>Segment {part + 1} of {clips.length} · camera time {clips[part]?.sourceOffset.toFixed(1)}s</p>
        <video key={clips[part]?.id} src={clips[part]?.url} controls autoPlay playsInline style={{width: "100%"}} onEnded={() => {if (part + 1 < clips.length) setPart(part + 1);}} />
        <div className="modal-actions"><Button disabled={part === 0} onClick={() => setPart(p => p-1)}>Previous</Button><Button disabled={part + 1 >= clips.length} onClick={() => setPart(p => p+1)}>Next</Button></div>
      </> : <p>Evidence has expired or was removed.</p>}
    </Modal>}
  </section>;
}
