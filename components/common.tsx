"use client";
import { useEffect, useEffectEvent, useRef } from "react";
import {
  X,
  LoaderCircle,
  Plus,
  ArrowUpRight,
  Camera as CameraIcon,
  Check,
  Search,
  AlertTriangle,
  Activity,
  ChevronRight,
} from "lucide-react";
import type { Event, Camera } from "@/lib/types";
export function Button({
  children,
  onClick,
  className = "",
  variant = "secondary",
  disabled = false,
  type = "button",
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
  title?: string;
}) {
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`btn ${variant} ${className}`}
    >
      {children}
    </button>
  );
}
export function Modal({
  title,
  subtitle,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeFromKeyboard = useEffectEvent(() => onClose());
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeFromKeyboard();
      if (e.key === "Tab") {
        const items = ref.current?.querySelectorAll<HTMLElement>(
          'button,input,select,textarea,a[href],[tabindex="0"]',
        );
        if (!items?.length) return;
        const first = items[0],
          last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handle);
    return () => {
      document.body.style.overflow = original;
      document.removeEventListener("keydown", handle);
      previous?.focus();
    };
    // Keep focus in the user's control across workspace polling and draft edits.
    // The effect event reads the latest callback without restarting focus setup.
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
      >
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            className="icon-btn"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={19} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Empty({
  icon: Icon = CameraIcon,
  title,
  text,
  action,
}: {
  icon?: any;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon size={25} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function Spinner({ text = "Loading…" }: { text?: string }) {
  return (
    <span className="loading-inline">
      <LoaderCircle className="spin" size={17} />
      {text}
    </span>
  );
}
export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`toggle ${checked ? "on" : ""}`}
      onClick={onChange}
    >
      <span />
    </button>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>
          {title}
          <span className="title-dot">.</span>
        </h1>
        <p>{description}</p>
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
export const time = (n: number) =>
  new Date(n).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
export const date = (n: number) =>
  new Date(n).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
export function relative(n: number) {
  const minutes = Math.max(0, Math.floor((Date.now() - n) / 60000));
  return minutes < 1
    ? "Just now"
    : minutes < 60
      ? `${minutes}m ago`
      : minutes < 1440
        ? `${Math.floor(minutes / 60)}h ago`
        : date(n);
}
export function EventRow({
  event,
  camera,
  onClick,
  compact = false,
}: {
  event: Event;
  camera?: Camera;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      className={`event-row ${compact ? "compact" : ""}`}
      onClick={onClick}
    >
      <span className={`event-symbol ${event.severity}`}>
        {event.severity === "critical" ? (
          <AlertTriangle size={15} />
        ) : event.severity === "warning" ? (
          <Activity size={15} />
        ) : (
          <CameraIcon size={15} />
        )}
      </span>
      <span className="event-copy">
        <span className="event-title">{event.title}</span>
        <span className="event-meta">
          {camera?.name || "Camera"} <span>·</span> {relative(event.timestamp)}
          {event.trackId && <> · Track {event.trackId.split("-").at(-1)} · {event.observationCount || 1} sightings</>}
        </span>
        {!compact && (
          <span className="event-description">{event.description}</span>
        )}
        {event.demo && <span className="sample-label">SAMPLE EVENT</span>}
      </span>
      {event.acknowledged ? (
        <Check size={14} className="muted" />
      ) : (
        <span className={`unread-dot ${event.severity}`} />
      )}
    </button>
  );
}
export function downloadJson(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
