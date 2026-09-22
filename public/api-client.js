function textDetails(data, rawText) {
  const detail = data?.details ?? data?.detail ?? "";
  if (detail) return typeof detail === "string" ? detail : JSON.stringify(detail, null, 2);
  return rawText.trim();
}

export async function readApiResponse(response) {
  const rawText = await response.text();
  let data = null;
  try { data = JSON.parse(rawText); } catch { /* 保留原始文本，以便完整展示 */ }

  if (!response.ok) {
    const lines = [`请求失败（HTTP ${response.status}）`];
    if (data?.message) lines.push(data.message);
    else if (response.status === 404) lines.push("服务端接口没有部署成功或路径不存在");
    else lines.push(response.statusText || "服务器返回错误");

    const details = textDetails(data, rawText);
    if (details && details !== data?.message) lines.push("", "详细信息：", details);
    throw new Error(lines.join("\n"));
  }

  if (!data || typeof data !== "object") {
    throw new Error(["服务器返回了无法识别的内容", "", "原始响应：", rawText || "（空响应）"].join("\n"));
  }
  return data;
}
