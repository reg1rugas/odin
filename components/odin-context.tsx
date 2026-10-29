"use client";
import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Workspace, Execution } from "@/lib/types";
export type Page =
  | "cameras"
  | "live"
  | "activity"
  | "analytics"
  | "triggers"
  | "workflows"
  | "integrations"
  | "chat"
  | "reports"
  | "faces"
  | "settings";
type AppContext = {
  data: Workspace | null;
  loading: boolean;
  error: string;
  api: (path: string, body?: any, method?: string) => Promise<any>;
  refresh: () => Promise<void>;
  notify: (text: string, type?: "success" | "error") => void;
  navigate: (page: Page, id?: string) => void;
  page: Page;
  selectedId: string;
  aiKey: string;
  setAiKey: (v: string) => void;
  persist: (kind: string, data: any) => Promise<void>;
  remove: (kind: string, id: string) => Promise<void>;
  deliver: (executions: Execution[]) => Promise<void>;
};
export const OdinContext = createContext<AppContext>(null!);
export const useOdin = () => useContext(OdinContext);
export function useOdinState() {
  const [data, setData] = useState<Workspace | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [page, setPage] = useState<Page>("cameras"),
    [selectedId, setSelectedId] = useState(""),
    [aiKey, setAiKey] = useState("");
  const [toast, setToast] = useState<{ text: string; type: string } | null>(
    null,
  );
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = useCallback((text: string, type = "success") => {
    setToast({ text, type });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 5000);
  }, []);
  const api = useCallback(
    async (path: string, body?: any, method?: string) => {
      const r = await fetch(`/api/${path}`, {
        method: method || (body ? "POST" : "GET"),
        headers: {
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(aiKey ? { "x-odin-ai-key": aiKey } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const result: any = await r.json();
      if (!r.ok) throw new Error(result.error || "Request failed.");
      return result;
    },
    [aiKey],
  );
  const refresh = useCallback(async () => {
    try {
      const r = await api("workspace");
      setData(r);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load workspace.");
    } finally {
      setLoading(false);
    }
  }, [api]);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 15000);
    return () => clearInterval(timer);
  }, [refresh]);
  useEffect(() => {
    const read = () => {
      const [p, id] = window.location.hash.slice(1).split("/");
      if (
        [
          "cameras",
          "live",
          "activity",
          "analytics",
          "triggers",
          "workflows",
          "integrations",
          "chat",
          "reports",
          "faces",
          "settings",
        ].includes(p)
      ) {
        setPage(p as Page);
        setSelectedId(id || "");
      }
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  const navigate = useCallback((p: Page, id = "") => {
    setPage(p);
    setSelectedId(id);
    window.location.hash = `${p}${id ? "/" + id : ""}`;
    window.scrollTo(0, 0);
  }, []);
  const persist = useCallback(
    async (kind: string, value: any) => {
      await api("records", { kind, data: value });
      await refresh();
    },
    [api, refresh],
  );
  const remove = useCallback(
    async (kind: string, id: string) => {
      await api("records", { kind, id }, "DELETE");
      await refresh();
    },
    [api, refresh],
  );
  const deliver = useCallback(
    async (executions: Execution[]) => {
      for (const ex of executions)
        for (const result of ex.results.filter((r) => r.status === "pending")) {
          let status = "success",
            message = "";
          try {
            if (result.action === "browser") {
              if (!data?.settings.notifications)
                throw new Error(
                  "In-app notifications are disabled in Settings.",
                );
              notify(ex.eventTitle);
              if (
                "Notification" in window &&
                Notification.permission === "granted"
              )
                new Notification("Odin alert", {
                  body: ex.eventTitle,
                  icon: "/favicon.svg",
                });
              message = "Displayed in the active monitoring browser.";
            } else if (result.action === "voice") {
              if (!data?.settings.voice)
                throw new Error(
                  "Voice announcements are disabled in Settings.",
                );
              if (!("speechSynthesis" in window))
                throw new Error(
                  "Speech synthesis is unavailable in this browser.",
                );
              const utterance = new SpeechSynthesisUtterance(ex.eventTitle);
              window.speechSynthesis.speak(utterance);
              message = "Voice announcement queued in the monitoring browser.";
            }
          } catch (e) {
            status = "failed";
            message =
              e instanceof Error ? e.message : "Browser delivery failed.";
          }
          await api(
            "executions",
            { id: ex.id, nodeId: result.nodeId, status, message },
            "PATCH",
          );
        }
    },
    [api, notify, data?.settings.notifications, data?.settings.voice],
  );
  return {
    context: {
      data,
      loading,
      error,
      api,
      refresh,
      notify,
      navigate,
      page,
      selectedId,
      aiKey,
      setAiKey,
      persist,
      remove,
      deliver,
    },
    toast,
  };
}
