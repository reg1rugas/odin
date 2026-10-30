"use client";
import { useOdin } from "./odin-context";
import { Badge, Button, time } from "./common";
import { useState } from "react";
export function WorkflowAlerts({cameraIds}: {cameraIds: string[]}) {
  const {data, persist, notify} = useOdin();
  const [activating, setActivating] = useState<string | null>(null);
  const workflows = (data?.workflows || []).filter(f => f.nodes.some(n => n.type === "input" && (!n.cameraId || cameraIds.includes(n.cameraId))));
  const paused = workflows.filter(f => !f.enabled);
  const ids = new Set(data?.events.filter(e => cameraIds.includes(e.cameraId)).map(e => e.id));
  const logs = [...(data?.executions || [])].filter(e => ids.has(e.eventId)).sort((a,b) => b.timestamp-a.timestamp).slice(0,3);
  if (!logs.length && !paused.length) return null;
  return <section className="analysis-summary" aria-live="polite" aria-label="Recent workflow results">
    {paused.map(flow => <div key={flow.id} style={{marginBottom: 8}}>
      <strong>{flow.name}</strong>{" "}<Badge tone="orange">Paused · alerts off</Badge>
      <p>Detection boxes still appear while this workflow is paused. Activate it to evaluate its rules and send alerts.</p>
      <Button disabled={activating !== null} onClick={async () => {
        setActivating(flow.id);
        try {
          await persist("workflows", {...flow, enabled: true});
          notify(`${flow.name} activated`);
        } catch (e) {notify((e as Error).message, "error");}
        finally {setActivating(null);}
      }}>{activating === flow.id ? "Activating…" : "Activate workflow"}</Button>
    </div>)}
    {!!logs.length && <strong>Recent workflow results</strong>}
    {logs.map(log => <div key={log.id} style={{marginTop: 8}}>
      <strong>{log.eventTitle}</strong>{" "}<Badge tone={log.status === "failed" ? "critical" : log.status === "skipped" ? "neutral" : log.status === "success" ? "lime" : "orange"}>{log.status}</Badge>
      <p>{log.workflowName} · {time(log.timestamp)}</p>
      {log.results.map(r => <small key={r.nodeId} style={{display:"block"}}>{r.message}</small>)}
    </div>)}
  </section>;
}
