import express from "express";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AnalyzeError, analyze, errorBody } from "./lib/analyze.js";

const app = express();
const publicDir = join(dirname(fileURLToPath(import.meta.url)), "public");

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

app.post("/api/analyze", async (req, res, next) => {
  try {
    const apiKey = req.get("x-typesafe-key")?.trim() || "";
    return res.json(await analyze({ apiKey, input: req.body }));
  } catch (error) {
    if (error instanceof AnalyzeError) return res.status(error.status).json(errorBody(error));
    return next(error);
  }
});

app.use(express.static(publicDir));
app.use((req, res, next) => {
  if (req.method !== "GET") return next();
  return res.sendFile(join(publicDir, "index.html"));
});
app.use((error, _req, res, _next) => {
  if (error?.type === "entity.too.large") return res.status(413).json({ message: "输入内容太长了，请精简后再试", status: 413 });
  if (error instanceof SyntaxError) return res.status(400).json({ message: "请求内容无法识别", status: 400, details: error.message });
  return res.status(500).json(errorBody(error));
});

if (!process.env.VERCEL) {
  const port = Number(process.env.PORT) || 4173;
  app.listen(port, () => console.log(`Jev Pocket: http://localhost:${port}`));
}
export default app;
