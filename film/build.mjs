// src/index.html의 <link>/<script src>와 폰트를 모두 인라인해서 index.html 한 파일로 만든다(이 폴더 바로 아래).
import { readFileSync, writeFileSync } from "node:fs";
const src = (p) => new URL("./src/" + p, import.meta.url);
const read = (p) => readFileSync(src(p), "utf8");
let html = read("index.html");
const css = read("style.css").replace(/url\("(fonts\/[^"]+\.woff2)"\)/g, (_, p) => `url(data:font/woff2;base64,${readFileSync(src(p)).toString("base64")})`);
html = html.replace('<link rel="stylesheet" href="style.css">', () => `<style>\n${css}</style>`);
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, p) => `<script>\n${read(p).replaceAll("</script", "<\\/script")}</script>`);
// node build.mjs --out <경로>  : 다른 곳에 빌드 (여러 사람이 동시에 시험할 때)
const oi = process.argv.indexOf("--out");
if (oi > 0) { writeFileSync(process.argv[oi + 1], html); console.log(`${process.argv[oi + 1]} ${(html.length / 1e6).toFixed(2)} MB`); }
else {
  writeFileSync(new URL("./index.html", import.meta.url), html);
  console.log(`index.html ${(html.length / 1e6).toFixed(2)} MB`);
}
