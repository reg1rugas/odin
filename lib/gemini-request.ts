export class GeminiRequestError extends Error {
  status: number;
  upstreamStatus?: number;
  constructor(message: string, status = 502, upstreamStatus?: number) {
    super(message);
    this.name = "GeminiRequestError";
    this.status = status;
    this.upstreamStatus = upstreamStatus;
  }
}

export function redactGeminiMessage(value: unknown, key: string): string {
  let text = typeof value === "string" ? value : "";
  if (key) {
    text = text.split(key).join("[REDACTED]");
    text = text.split(encodeURIComponent(key)).join("[REDACTED]");
  }
  return text
    .replace(/AIza[A-Za-z0-9_-]+/g, "[REDACTED]")
    .replace(/([?&](?:key|api_key)=)[^\s&"']+/gi, "$1[REDACTED]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1000);
}

type GeminiOptions = {
  model: string;
  key: string;
  parts: unknown[];
  json?: boolean;
  timeoutMs?: number;
  fetcher?: typeof fetch;
  maxRetries?: number;
  sleep?: (ms: number) => Promise<void>;
  onUsage?: (usage: { inputTokens: number; outputTokens: number; thinkingTokens: number; totalTokens: number }) => Promise<void>;
  log?: (details: Record<string, unknown>) => void;
};

export async function requestGemini({
  model,
  key,
  parts,
  json = false,
  timeoutMs = 45000,
  fetcher = fetch,
  maxRetries = 0,
  sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  onUsage,
  log = (details) => console.error("[Odin Gemini]", JSON.stringify(details)),
}: GeminiOptions) {
  const started = Date.now();
  try {
    let attempt = 0;
    const retryingFetch: typeof fetch = async (url, options) => {
      for (;;) {
        const response = await fetcher(url, options);
        if (![500, 502, 503, 504].includes(response.status) || attempt >= Math.min(2, maxRetries)) return response;
        await response.body?.cancel();
        await sleep(500 * 2 ** attempt++ + Math.random() * 250);
      }
    };
    const response = await retryingFetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: {
            ...(/^gemini-(3|4)/.test(model) ? {} : { temperature: 0.2 }),
            ...(/^gemini-3\.[678]-flash$/.test(model)
              ? { thinkingConfig: { thinkingLevel: "low" } }
              : {}),
            maxOutputTokens: 4096,
            ...(json ? { responseMimeType: "application/json" } : {}),
          },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    let data: any;
    try {
      data = await response.json();
    } catch (error) {
      if (
        error instanceof Error &&
        ["TimeoutError", "AbortError"].includes(error.name)
      )
        throw error;
      data = null;
    }
    if (!response.ok) {
      const reason = redactGeminiMessage(data?.error?.message, key);
      const hint =
        response.status === 429
          ? "Gemini quota or rate limit reached. Check your project's quota and billing."
          : response.status === 404
            ? `Gemini model '${model}' is unavailable for this API key. Choose an available model in Settings → Intelligence.`
            : response.status === 401 || response.status === 403
              ? "Gemini rejected the API key or its permissions. Check your key and project access."
              : `Gemini returned HTTP ${response.status}.`;
      log({
        model,
        upstreamStatus: response.status,
        providerStatus: redactGeminiMessage(data?.error?.status, key),
        reason,
        elapsedMs: Date.now() - started,
      });
      throw new GeminiRequestError(
        reason ? `${hint} ${reason}` : hint,
        response.status === 429 ? 429 : 502,
        response.status,
      );
    }
    const finish = data?.candidates?.[0]?.finishReason;
    if (finish && finish !== "STOP") {
      throw new GeminiRequestError(finish === "MAX_TOKENS"
        ? "Gemini reached its output limit before completing the response. Try a shorter request."
        : "Gemini did not complete a usable analysis. No rules were verified.");
    }
    const text = data?.candidates?.[0]?.content?.parts
      ?.filter((part: any) => !part.thought)
      .map((part: any) => part.text || "")
      .join("");
    if (!text) {
      const blockReason = redactGeminiMessage(
        data?.promptFeedback?.blockReason,
        key,
      );
      const finishReason = redactGeminiMessage(
        data?.candidates?.[0]?.finishReason,
        key,
      );
      log({
        model,
        upstreamStatus: response.status,
        blockReason,
        finishReason,
        elapsedMs: Date.now() - started,
      });
      throw new GeminiRequestError(
        blockReason
          ? `Gemini blocked this request (${blockReason}).`
          : finishReason === "MAX_TOKENS"
            ? "Gemini reached its output limit before completing the response. Try a shorter request."
            : "Gemini returned no answer. Try again with a simpler request.",
      );
    }
    if (onUsage && data?.usageMetadata) {
      const count = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : 0;
      await onUsage({inputTokens: count(data.usageMetadata.promptTokenCount), outputTokens: count(data.usageMetadata.candidatesTokenCount), thinkingTokens: count(data.usageMetadata.thoughtsTokenCount), totalTokens: count(data.usageMetadata.totalTokenCount)});
    }
    if (!json) return text;
    try {
      return JSON.parse(text);
    } catch {
      log({
        model,
        upstreamStatus: response.status,
        error: "invalid_json",
        elapsedMs: Date.now() - started,
      });
      throw new GeminiRequestError(
        "Gemini returned incomplete or invalid JSON. Retry the analysis.",
      );
    }
  } catch (error) {
    if (error instanceof GeminiRequestError) throw error;
    const timeout =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");
    log({
      model,
      error: timeout ? "timeout" : "network_error",
      elapsedMs: Date.now() - started,
    });
    throw new GeminiRequestError(
      timeout
        ? `Gemini did not respond within ${Math.round(timeoutMs / 1000)} seconds. Retry, or select another available model in Settings → Intelligence.`
        : "Odin could not connect to Gemini. Check your internet connection, proxy, or firewall and retry.",
      timeout ? 504 : 502,
    );
  }
}
