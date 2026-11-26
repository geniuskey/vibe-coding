// 헤드리스 Chrome으로 장면을 원하는 순간에 멈춰 찍는다.
// 사용: node tools/shoot.mjs --out shots/x "stairs:2:999" "loop:3:1.2" [--trans loop:0.5] [--perf loop:3] [--w 1920 --h 1080] [--file index.html] [--eval "js"]
//   "<장면 번호 또는 id>:<비트(1부터)>:<비트 시작 후 초(999=안정)>[:<장면 시간>]"
//   --trans <id>:<p>  이전 장면 → 이 장면 전환을 p(0..1) 시점에서
//   --perf <id>:<비트> 프레임당 GPU 시간(ms)
import { launch } from "./cdp.mjs";
const args = process.argv.slice(2);
const opt = { w: 1920, h: 1080, file: new URL("../index.html", import.meta.url).pathname, q: "1" };
const shots = [], trans = [], perf = [];
let prefix = "shot";
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--w") opt.w = +args[++i]; else if (a === "--h") opt.h = +args[++i];
  else if (a === "--file") opt.file = args[++i]; else if (a === "--q") opt.q = args[++i];
  else if (a === "--trans") trans.push(args[++i]); else if (a === "--perf") perf.push(args[++i]);
  else if (a === "--out") prefix = args[++i];
  else if (a === "--eval") { (opt.evals ||= []).push(args[++i]); }
  else shots.push(a);
}
const b = await launch({ width: opt.w, height: opt.h });
const t0 = Date.now();
try {
  // 장면은 번호(1부터) 또는 id로 지정: "stairs:2:999" = stairs 장면 2번째 비트, 비트 시작 후 999초(=안정 상태)
  const ids = await (async () => {
    await b.goto(`file://${opt.file}?q=${opt.q}&quick#/1/1`);
    for (let k = 0; k < 200; k++) { const ok = await b.eval("!!(window.__deck && window.__deck.seek)").catch(() => false); if (ok) break; await b.wait(100); }
    return b.eval("window.__deck.R.map(r => r.def.id)");
  })();
  const idx = (v) => (/^\d+$/.test(v) ? +v : ids.indexOf(v) + 1);
  console.log("ready in", Date.now() - t0, "ms", "scenes:", ids.join(","));
  for (const s of shots) {
    const parts = s.split(":"); const i = idx(parts[0]); const [beat, t, time] = parts.slice(1).map(Number);
    if (i < 1) { console.log("unknown scene", parts[0]); continue; }
    await b.eval(`window.__deck.seek(${i - 1}, ${beat - 1}, ${t ?? 999}, ${time ?? 12}).then(p => JSON.stringify(p))`);
    await b.wait(120);
    const f = `${prefix}-${parts[0]}-${beat}-${t}.jpg`; await b.shot(f); console.log("saved", f);
  }
  for (const s of trans) {
    const parts = s.split(":"); const i = idx(parts[0]); const p = +parts[1];
    await b.eval(`window.__deck.seekTrans(${i - 1}, ${p})`);
    await b.wait(120);
    const f = `${prefix}-T${i}-${p}.jpg`; await b.shot(f); console.log("saved", f);
  }
  for (const e of opt.evals || []) { try { console.log("eval:", JSON.stringify(await b.eval(e))); } catch (err) { console.log("eval error:", err.message); } }
  for (const s of perf) {
    const parts = s.split(":"); const i = idx(parts[0]); const beat = +parts[1];
    const ms = await b.eval(`window.__deck.perf(${i - 1}, ${beat - 1}, 40)`);
    console.log(`perf scene ${i} beat ${beat}: ${ms.toFixed(2)} ms/frame`);
  }
} catch (e) { console.error("ERR", e.message); }
finally {
  const logs = b.logs.filter((l) => !/GPU stall|Automatic fallback/.test(l));
  if (logs.length) console.log("--- console ---\n" + logs.slice(0, 40).join("\n"));
  await b.close();
}
