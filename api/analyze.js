import { AnalyzeError, analyze, errorBody } from "../lib/analyze.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "POST") {
    return res.status(405).json({ message: "这里只接受 POST 请求", status: 405 });
  }

  try {
    const input = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const header = req.headers["x-typesafe-key"];
    const apiKey = (Array.isArray(header) ? header[0] : header || "").trim();
    return res.status(200).json(await analyze({ apiKey, input }));
  } catch (error) {
    if (error instanceof SyntaxError) {
      return res.status(400).json({ message: "请求内容无法识别", status: 400, details: error.message });
    }
    const body = errorBody(error);
    return res.status(error instanceof AnalyzeError ? error.status : 500).json(body);
  }
}
