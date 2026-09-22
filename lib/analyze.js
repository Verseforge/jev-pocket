const allowedModes = new Set(["noul", "choice", "score"]);

export class AnalyzeError extends Error {
  constructor(status, message, details = "") {
    super(message);
    this.name = "AnalyzeError";
    this.status = status;
    this.details = details;
  }
}

function normalizeAnswer(answer, mode) {
  if (mode === "noul") {
    const value = Math.max(0, Math.min(1, Number(answer?.noul ?? 0)));
    return {
      kind: "noul",
      label: value >= 0.5 ? "是" : "否",
      confidence: Math.round((value >= 0.5 ? value : 1 - value) * 100),
    };
  }
  if (mode === "choice") {
    return {
      kind: "choice",
      label: String(answer?.choice ?? "无法判断"),
      confidence: Math.round(Number(answer?.confidence ?? 0) * 100),
    };
  }
  const score = Number(answer?.score ?? 0);
  return {
    kind: "score",
    score: Number(score.toFixed(1)),
    confidence: Math.round(Number(answer?.confidence ?? 0) * 100),
  };
}

function cleanItems(value, maxItems = 12) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.slice(0, maxItems).map((item) => String(item).trim().slice(0, 80)).filter(Boolean))];
}

function readableDetails(raw, rawText) {
  const candidate = raw?.detail ?? raw?.message ?? raw?.error ?? rawText;
  if (!candidate) return "";
  const text = typeof candidate === "string" ? candidate : JSON.stringify(candidate, null, 2);
  return text.trim().slice(0, 4000);
}

export function errorBody(error) {
  return {
    message: error?.message || "出现了一点问题，请稍后重试",
    status: Number(error?.status) || 500,
    ...(error?.details ? { details: error.details } : {}),
  };
}

export async function analyze({ apiKey, input, fetchImpl = fetch }) {
  const text = typeof input?.text === "string" ? input.text.trim() : "";
  const question = typeof input?.question === "string" ? input.question.trim() : "";
  const mode = input?.mode;

  if (!apiKey || apiKey.length > 500) throw new AnalyzeError(400, "请先在设置里填写有效的 API Key");
  if (!text || !question) throw new AnalyzeError(400, "内容和问题都需要填写");
  if (text.length > 5000 || question.length > 200) throw new AnalyzeError(400, "输入内容太长了，请精简后再试");
  if (!allowedModes.has(mode)) throw new AnalyzeError(400, "请选择一种判断方式");

  const prompt = { type: mode, instructions: question };
  if (mode === "choice") {
    const options = cleanItems(input.options);
    if (options.length < 2) throw new AnalyzeError(400, "多选一至少需要两个不同的选项");
    prompt.criteria = Object.fromEntries(options.map((option) => [option, option]));
  }
  if (mode === "score") {
    const levels = cleanItems(input.levels);
    if (levels.length < 2) throw new AnalyzeError(400, "程度评分至少需要两个不同的等级");
    prompt.criteria = levels;
  }

  let upstream;
  try {
    upstream = await fetchImpl("https://api.typesafe.ai/v1/systemone", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "jev-latest", state: text, questions: { result: prompt } }),
      signal: AbortSignal.timeout(25_000),
    });
  } catch (error) {
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
    throw new AnalyzeError(504, timedOut ? "等待时间有点久，请稍后重试" : "暂时无法连接 TypeSafe，请稍后重试", error?.message || "");
  }

  const rawText = await upstream.text();
  let raw = {};
  try { raw = JSON.parse(rawText); } catch { /* 非 JSON 响应会保留在 details 中 */ }

  if (!upstream.ok) {
    const messages = {
      400: "这次的请求无法处理，请检查输入后再试",
      401: "API Key 不正确或已失效，请到 TypeSafe 控制台确认",
      403: "这个 API Key 暂时无权使用该服务",
      422: "这次的判断设置有问题，请检查问题和选项",
      429: "请求有点频繁，稍等一会儿再试",
      529: "TypeSafe 服务现在有点忙，稍后再试",
    };
    throw new AnalyzeError(
      upstream.status,
      messages[upstream.status] || "TypeSafe 暂时无法完成判断",
      readableDetails(raw, rawText),
    );
  }

  if (!raw?.answers?.result) {
    throw new AnalyzeError(502, "TypeSafe 返回了意外结果，请稍后再试", readableDetails(raw, rawText));
  }
  return { result: normalizeAnswer(raw.answers.result, mode) };
}
