// 최소한의 Chrome DevTools Protocol 드라이버: 헤드리스 Chrome을 띄워 페이지를 열고, 키를 누르고, 화면을 찍는다.
// CHROME 환경 변수로 Chrome 경로를 바꿀 수 있다(기본: macOS 기본 위치).
import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
export async function launch({ width = 1920, height = 1080, port = 9333 + Math.floor(Math.random() * 500) } = {}) {
  const prof = mkdtempSync(join(process.env.SCRATCH || tmpdir(), "chr-"));
  const proc = spawn(CHROME, [
    "--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`,
    `--window-size=${width},${height}`, "--hide-scrollbars", "--mute-audio",
    "--autoplay-policy=no-user-gesture-required", "--enable-gpu", "--use-angle=metal", "--ignore-gpu-blocklist",
    "--enable-unsafe-swiftshader", "--no-first-run", "--no-default-browser-check", "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  let wsUrl = null;
  for (let i = 0; i < 100 && !wsUrl; i++) {
    await new Promise((r) => setTimeout(r, 100));
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const pg = list.find((t) => t.type === "page");
      if (pg) wsUrl = pg.webSocketDebuggerUrl;
    } catch {}
  }
  if (!wsUrl) throw new Error("chrome did not start");
  const ws = new WebSocket(wsUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pending = new Map(); const listeners = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); }
    else listeners.forEach((f) => f(m));
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  const logs = [];
  listeners.push((m) => {
    if (m.method === "Runtime.consoleAPICalled") logs.push(`[${m.params.type}] ` + m.params.args.map((a) => a.value ?? a.description ?? "").join(" "));
    if (m.method === "Runtime.exceptionThrown") logs.push("[exception] " + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
  });
  await send("Runtime.enable"); await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
  const api = {
    send, logs,
    async goto(url) { await send("Page.navigate", { url }); await new Promise((r) => setTimeout(r, 300)); },
    async eval(expr) { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; },
    async key(key, code = key) {
      const vk = { ArrowRight: 39, ArrowLeft: 37, " ": 32, Enter: 13, Escape: 27 }[key] || key.toUpperCase().charCodeAt(0);
      await send("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: vk });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: vk });
    },
    async shot(path, { quality = 80 } = {}) {
      const r = await send("Page.captureScreenshot", { format: path.endsWith(".png") ? "png" : "jpeg", quality });
      writeFileSync(path, Buffer.from(r.data, "base64"));
    },
    wait: (ms) => new Promise((r) => setTimeout(r, ms)),
    async close() {
      try { ws.close(); } catch {}
      proc.kill("SIGKILL");
      await new Promise((r) => setTimeout(r, 200));
      try { rmSync(prof, { recursive: true, force: true }); } catch {}
    },
  };
  return api;
}
