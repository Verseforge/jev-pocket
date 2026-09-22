import express from "express";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const publicDir = join(dirname(fileURLToPath(import.meta.url)), "public");
const allowedModes = new Set(["noul", "choice", "score"]);

app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));
app.use((req, res, next) => {
  res.set({
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  });
  next();
});

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

app.post("/api/analyze", async (req, res) => {
  const apiKey = req.get("x-typesafe-key")?.trim();
  const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
  const mode = req.body?.mode;

  if (!apiKey || apiKey.length > 500) return res.status(400).json({ message: "请先在设置里填写有效的 API Key" });
  if (!text || !question) return res.status(400).json({ message: "内容和问题都需要填写" });
  if (text.length > 5000 || question.length > 200) return res.status(400).json({ message: "输入内容太长了，请精简后再试" });
  if (!allowedModes.has(mode)) return res.status(400).json({ message: "请选择一种判断方式" });

  const prompt = { type: mode, instructions: question };
  if (mode === "choice") {
    const options = cleanItems(req.body.options);
    if (options.length < 2) return res.status(400).json({ message: "多选一至少需要两个不同的选项" });
    prompt.criteria = Object.fromEntries(options.map((option) => [option, option]));
  }
  if (mode === "score") {
    const levels = cleanItems(req.body.levels);
    if (levels.length < 2) return res.status(400).json({ message: "程度评分至少需要两个不同的等级" });
    prompt.criteria = levels;
  }

  try {
    const upstream = await fetch("https://api.typesafe.ai/v1/systemone", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "jev-latest", state: text, questions: { result: prompt } }),
      signal: AbortSignal.timeout(25_000),
    });
    const rawText = await upstream.text();
    let raw = {};
    try { raw = JSON.parse(rawText); } catch { /* 交给下面的统一提示处理 */ }

    if (!upstream.ok) {
      const messages = {
        400: "这次的请求无法处理，请检查输入后再试",
        401: "API Key 不正确，请检查后再试",
        403: "这个 API Key 暂时无权使用该服务",
        422: "这次的判断设置有问题，请换个说法",
        429: "请求有点频繁，稍等一会儿再试",
        529: "服务现在有点忙，稍后再试",
      };
      return res.status(upstream.status).json({ message: messages[upstream.status] || "TypeSafe 暂时无法完成判断" });
    }
    if (!raw?.answers?.result) return res.status(502).json({ message: "TypeSafe 返回了意外结果，请稍后再试" });
    return res.json({ result: normalizeAnswer(raw.answers.result, mode) });
  } catch (error) {
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
    return res.status(504).json({ message: timedOut ? "等待时间有点久，请稍后重试" : "暂时无法连接 TypeSafe，请稍后重试" });
  }
});

app.use(express.static(publicDir));
app.use((req, res, next) => {
  if (req.method !== "GET") return next();
  return res.sendFile(join(publicDir, "index.html"));
});
app.use((error, _req, res, _next) => {
  if (error?.type === "entity.too.large") return res.status(413).json({ message: "输入内容太长了，请精简后再试" });
  if (error instanceof SyntaxError) return res.status(400).json({ message: "请求内容无法识别" });
  return res.status(500).json({ message: "出现了一点问题，请稍后重试" });
});

if (!process.env.VERCEL) {
  const port = Number(process.env.PORT) || 4173;
  app.listen(port, () => console.log(`Jev Pocket: http://localhost:${port}`));
}

export default app;
