import test from "node:test";
import assert from "node:assert/strict";
import { AnalyzeError, analyze } from "../lib/analyze.js";
import { readApiResponse } from "../public/api-client.js";

const input = { text: "这是一段测试内容", question: "是否明显？", mode: "noul" };

test("TypeSafe 401 会保留状态和详细信息", async () => {
  const fetchImpl = async () => new Response(JSON.stringify({ detail: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
  await assert.rejects(
    analyze({ apiKey: "111", input, fetchImpl }),
    (error) => error instanceof AnalyzeError && error.status === 401 && error.details === "Unauthorized",
  );
});

test("成功的 noul 响应会转换成人话结果", async () => {
  const fetchImpl = async () => new Response(JSON.stringify({ answers: { result: { type: "noul", noul: 0.91 } } }));
  const data = await analyze({ apiKey: "test-key", input, fetchImpl });
  assert.deepEqual(data.result, { kind: "noul", label: "是", confidence: 91 });
});

test("纯文本 404 不会再被 JSON 解析错误遮蔽", async () => {
  const response = new Response("The page could not be found\nNOT_FOUND", { status: 404, statusText: "Not Found" });
  await assert.rejects(
    readApiResponse(response),
    (error) => error.message.includes("HTTP 404") && error.message.includes("The page could not be found"),
  );
});

test("JSON 错误会同时显示可读原因和详细信息", async () => {
  const response = new Response(JSON.stringify({ message: "API Key 不正确", details: "Unauthorized" }), { status: 401 });
  await assert.rejects(
    readApiResponse(response),
    (error) => error.message.includes("HTTP 401") && error.message.includes("API Key 不正确") && error.message.includes("Unauthorized"),
  );
});
