if (!sess()) location = "login.html";
const lines = t => t.split("\n").map(x => x.trim()).filter(Boolean), cap = s => s.replace(/\b\w/g, c => c.toUpperCase()), cnt = (t, k) => t.split(k.toLowerCase()).length - 1;
const STOP = new Set("a an and are as at be but by can for from has have how i if in into is it its of on or our so that the their them then there these they this to was we were what when where which who why will with you your not no yes all any more most other some such than too very just also about over under out up down new one two".split(" "));
const norm = u => /^https?:\/\//i.test(u.trim()) ? u.trim() : "https://" + u.trim();
const tags = a => a.map(x => `<span class="tag">${esc(x)}</span>`).join("");
const dl = (n, t, m = "text/plain") => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([t], { type: m })); a.download = n; a.click() };
const isQ = k => /^(how|what|why|when|can|is|which|where)\b/.test(k);
$$("[data-tab]").forEach(b => b.onclick = () => { $$("[data-tab]").forEach(x => x.classList.toggle("on", x === b)); $$(".panel").forEach(p => p.classList.toggle("on", p.id === b.dataset.tab)) });
$("[data-tab]").click();
async function run(out, fn) {
  const o = $("#" + out); o.innerHTML = '<p class="mute">Working, this can take up to a minute. Keep this tab open...</p>';
  try { o.innerHTML = await fn() } catch (e) { o.innerHTML = `<p class="hi">${esc(e.message)}</p>` }
}
function terms(text) {
  const toks = text.toLowerCase().match(/[a-z][a-z'-]{2,}/g) || [], c = {}, add = k => c[k] = (c[k] || 0) + 1;
  toks.forEach(t => { if (!STOP.has(t)) add(t) });
  for (let i = 0; i < toks.length - 1; i++) if (!STOP.has(toks[i]) && !STOP.has(toks[i + 1])) add(toks[i] + " " + toks[i + 1]);
  return Object.entries(c).sort((a, b) => b[1] - a[1]);
}
function analyze(url, x) {
  const d = { url, status: x.status, secs: +((x.ms || 0) / 1000).toFixed(2), kb: Math.round((x.size || 0) / 1024), issues: [], links: [], text: "", title: "", desc: "", h1: [], h2: [], words: 0 };
  const I = (l, m) => d.issues.push([l, m]);
  if (!x.status) { I("high", "Failed to load"); return d }
  if (x.status >= 400) { I("high", "Page error: HTTP " + x.status); return d }
  if (!x.body) return d;
  const doc = new DOMParser().parseFromString(x.body, "text/html");
  const meta = (n, a = "name") => (doc.querySelector(`meta[${a}="${n}" i]`)?.content || "").trim();
  d.title = (doc.title || "").trim(); d.desc = meta("description");
  d.h1 = [...doc.querySelectorAll("h1")].map(h => h.textContent.trim());
  d.h2 = [...doc.querySelectorAll("h2")].slice(0, 15).map(h => h.textContent.trim());
  const noalt = [...doc.images].filter(i => !(i.getAttribute("alt") || "").trim()).length;
  doc.querySelectorAll("a[href]").forEach(a => { try { const u = new URL(a.getAttribute("href"), url); if (/^https?:$/.test(u.protocol)) { u.hash = ""; d.links.push(u.href) } } catch (e) { } });
  const noindex = /noindex/i.test(meta("robots")), og = !!doc.querySelector('meta[property="og:title"]'), ld = !!doc.querySelector('script[type="application/ld+json"]'),
    lang = !!doc.documentElement.getAttribute("lang"), canon = !!doc.querySelector('link[rel="canonical"]'), vp = !!meta("viewport");
  doc.querySelectorAll("script,style,noscript").forEach(n => n.remove());
  d.text = (doc.body?.textContent || "").replace(/\s+/g, " ").trim(); d.words = d.text ? d.text.split(" ").length : 0;
  const t = d.title.length, m = d.desc.length;
  if (!t) I("high", "Title tag is missing"); else if (t < 30 || t > 65) I("med", `Title length is ${t} (30-65 recommended)`);
  if (!m) I("high", "Meta description is missing"); else if (m < 70 || m > 160) I("low", `Meta description length ${m} (70-160 recommended)`);
  if (!d.h1.length) I("high", "H1 heading is missing"); else if (d.h1.length > 1) I("low", `${d.h1.length} H1 headings found, use only 1`);
  if (noalt) I("med", `${noalt} images have no alt text`);
  if (d.words < 300) I("med", `Thin content (${d.words} words), aim for 300+`);
  if (!canon) I("low", "Canonical tag is missing"); if (!vp) I("high", "Mobile viewport tag is missing");
  if (d.secs > 4) I("med", `Page is slow (${d.secs}s)`); if (!url.startsWith("https")) I("high", "Page is not on HTTPS");
  if (noindex) I("high", "Page is set to noindex (hidden from Google)"); if (!og) I("low", "Open Graph tags missing (poor link previews when shared)");
  if (!ld) I("low", "No structured data (schema) found"); if (!lang) I("low", "HTML lang attribute is missing"); if (d.kb > 1500) I("med", `Page is heavy (${d.kb} KB)`);
  return d;
}
async function crawl(start, limit) {
  limit = Math.min(limit || 12, 12); const host = new URL(start).host, seen = new Set(), pages = []; let q = [start];
  while (q.length && pages.length < limit) {
    const batch = []; while (q.length && batch.length < Math.min(5, limit - pages.length)) { const u = q.shift(); if (!seen.has(u)) { seen.add(u); batch.push(u) } }
    if (!batch.length) continue;
    (await api("fetch", { urls: batch })).results.forEach((x, i) => {
      const p = analyze(batch[i], x); pages.push(p);
      p.links.forEach(l => { try { const h = new URL(l); if (h.host === host && !seen.has(l) && !q.includes(l) && !/\.(jpe?g|png|gif|pdf|zip|css|js|svg|webp|ico|mp4|xml)$/i.test(h.pathname)) q.push(l) } catch (e) { } });
    });
  }
  const tc = {}; pages.forEach(p => { if (p.title) tc[p.title] = (tc[p.title] || 0) + 1 });
  pages.forEach(p => { if (p.title && tc[p.title] > 1) p.issues.push(["med", "Duplicate title (same on another page)"]) });
  return pages;
}
async function siteChecks(origin) {
  const o = [], r = (await api("fetch", { urls: [origin + "/robots.txt", origin + "/sitemap.xml", origin + "/this-page-should-not-exist-7391"] })).results;
  const rb = r[0].status === 200 && /user-agent/i.test(r[0].body || ""); o.push([rb ? "pass" : "warn", rb ? "robots.txt found" : "robots.txt is missing"]);
  if (rb && /^disallow:\s*\/\s*$/im.test(r[0].body)) o.push(["fail", "robots.txt may block the whole site (Disallow: /)"]);
  const sm = r[1].status === 200 && /<urlset|<sitemapindex/.test(r[1].body || ""); o.push([sm ? "pass" : "warn", sm ? "sitemap.xml found" : "sitemap.xml is missing (generate one in the Rank plan tab)"]);
  if (origin.startsWith("https")) {
    const h = (await api("fetch", { urls: [origin.replace("https", "http") + "/"], noredirect: true })).results[0], ok = [301, 302, 307, 308].includes(h.status) && /^https/i.test(h.loc || "");
    o.push([ok ? "pass" : "warn", ok ? "HTTP redirects to HTTPS" : "HTTP version does not redirect to HTTPS"]);
  } else o.push(["fail", "Site is not using HTTPS"]);
  const nf = r[2].status === 404; o.push([nf ? "pass" : "warn", nf ? "Missing pages return a proper 404" : "Missing pages return 200 instead of 404 (soft 404)"]);
  return o;
}
async function expand(seed) {
  const qs = [seed, ..."abcdefghijklmnopqrstuvwxyz".split("").map(c => seed + " " + c), ...["how", "what", "why", "best", "when", "can", "is", "cheap", "near me"].map(p => p + " " + seed), ...["vs", "for", "price", "review", "online", "tips"].map(s => seed + " " + s)];
  return [...new Set((await api("suggest", { queries: qs })).lists.flat())];
}
const cut = (s, n) => { s = s.trim(); return s.length <= n ? s : s.slice(0, n).replace(/\s+\S*$/, "").replace(/[ \-|,:]+$/, "") };
const issueRows = ps => ps.map(p => `<tr><td>${esc(p.url)}</td><td>${p.status}</td><td>${p.secs}s</td><td>${p.kb || 0} KB</td><td>${p.words}</td><td>${p.issues.map(i => `<div class="${i[0]}">${esc(i[1])}</div>`).join("") || "OK"}</td></tr>`).join("");

let AUD = null, FIX = null;
const audit = () => run("a_out", async () => {
  const start = norm($("#a_url").value), origin = new URL(start).origin, pages = await crawl(start, +$("#a_lim").value);
  const seen = new Set(pages.map(p => p.url.replace(/\/$/, ""))), srcs = {}; pages.forEach(p => p.links.forEach(l => { if (!srcs[l]) srcs[l] = p.url }));
  const todo = Object.keys(srcs).filter(l => !seen.has(l.replace(/\/$/, ""))).slice(0, 40), st = [];
  for (let i = 0; i < todo.length; i += 12) st.push(...(await api("fetch", { urls: todo.slice(i, i + 12), method: "head" })).results.map(r => r.status));
  const broken = todo.map((l, i) => ({ url: l, status: st[i], found_on: srcs[l] })).filter(b => b.status === 0 || b.status === 404 || b.status === 410 || b.status >= 500);
  const site = await siteChecks(origin), c = { high: 0, med: 0, low: 0 }, pen = { high: 6, med: 3, low: 1 }; let tot = 0;
  pages.forEach(p => p.issues.forEach(i => { c[i[0]]++; tot += pen[i[0]] }));
  const score = Math.max(0, Math.round(100 - (tot / Math.max(1, pages.length) * 2.5 + 3 * broken.length + site.filter(x => x[0] !== "pass").reduce((a, x) => a + (x[0] === "fail" ? 6 : 2), 0))));
  AUD = { pages, broken };
  return `<div class="score">${score}/100</div><span class="mute">SEO health score</span>
  <p><span class="tag hi">${c.high} serious</span><span class="tag med">${c.med} medium</span><span class="tag low">${c.low} minor</span><span class="tag">${broken.length} broken links (${todo.length} checked)</span></p>
  <button class="go alt" onclick="csv()">Download CSV</button><button class="go alt" onclick="window.print()">Print report</button>
  <h3>Site-wide checks</h3><table>${site.map(s => `<tr><td class="${s[0] === "pass" ? "" : s[0] === "fail" ? "hi" : "med"}">${s[0].toUpperCase()}</td><td>${esc(s[1])}</td></tr>`).join("")}</table>
  <h3>Broken links</h3>${broken.length ? `<table><tr><th>Link</th><th>Status</th><th>Found on</th></tr>${broken.map(b => `<tr><td>${esc(b.url)}</td><td class="hi">${b.status || "No response"}</td><td>${esc(b.found_on)}</td></tr>`).join("")}</table>` : '<p class="mute">No broken links found.</p>'}
  <h3>Pages and issues</h3><table><tr><th>Page</th><th>Status</th><th>Speed</th><th>Size</th><th>Words</th><th>Issues</th></tr>${issueRows(pages)}</table>
  <h3>Most used terms</h3>${tags(terms(pages.map(p => p.text).join(" ")).slice(0, 25).map(t => t[0] + " (" + t[1] + ")"))}`;
});
function csv() {
  const q = v => { v = String(v ?? ""); if (/^[=+\-@]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"' };
  let t = "Page,Status,Seconds,KB,Words,Issues\n" + AUD.pages.map(p => [p.url, p.status, p.secs, p.kb, p.words, p.issues.map(i => i[0] + ": " + i[1]).join(" | ")].map(q).join(",")).join("\n");
  t += "\n\nBroken link,Status,Found on\n" + AUD.broken.map(b => [b.url, b.status, b.found_on].map(q).join(",")).join("\n"); dl("seo-audit.csv", t, "text/csv");
}
const suggestKw = () => run("p_out", async () => { $("#p_kw").value = (await expand($("#p_niche").value.trim())).slice(0, 15).join("\n"); return '<p class="mute">Keywords added. Edit the list if needed, then build the plan.</p>' });
const optimize = () => run("p_out", async () => {
  const start = norm($("#p_url").value), kws = lines($("#p_kw").value).slice(0, 25), u = new URL(start), brand = cap(u.host.replace(/^www\./, "").split(".")[0]);
  const pages = (await crawl(start, 12)).filter(p => p.status === 200 && p.text), used = new Set(), out = [], counts = {};
  pages.forEach(p => {
    p.issues.forEach(i => { const k = i[0] + "|" + i[1].replace(/\d+(\.\d+)?/g, "N"); counts[k] = (counts[k] || 0) + 1 });
    const t = p.text.toLowerCase(), cand = kws.filter(k => !used.has(k)).sort((a, b) => cnt(t, b) - cnt(t, a)), kw = cand.length && cnt(t, cand[0]) > 0 ? cand[0] : ""; if (kw) used.add(kw);
    let base = p.h1[0] || p.title || brand; if (kw && !base.toLowerCase().includes(kw.toLowerCase())) base = cap(kw) + " - " + base;
    const title = base.length + brand.length + 3 <= 60 ? cut(base + " | " + brand, 60) : cut(base, 60);
    const sents = p.text.split(/(?<=[.!?])\s+/).filter(x => x.length >= 60); let pick = sents.find(x => kw && x.toLowerCase().includes(kw.toLowerCase())) || sents[0] || p.text.slice(0, 150);
    if (kw && !pick.toLowerCase().includes(kw.toLowerCase())) pick = cap(kw) + ": " + pick;
    out.push({ url: p.url, kw, title_now: p.title, title_new: title, desc_now: p.desc, desc_new: cut(pick, 155), links: [], t, l: p.links });
  });
  out.forEach(a => out.forEach(b => { if (a !== b && b.kw && a.t.includes(b.kw.toLowerCase()) && !a.l.some(x => x.replace(/\/$/, "") === b.url.replace(/\/$/, "")) && a.links.length < 3) a.links.push({ anchor: b.kw, to: b.url }) }));
  const np = kws.filter(k => !used.has(k)).map(k => ({ keyword: k, title: `${cap(k)}: Complete Guide (${new Date().getFullYear()})`, slug: "/" + k.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") }));
  const rank = { high: 0, med: 1, low: 2 }, iss = Object.entries(counts).map(([k, n]) => [...k.split("|"), n]).sort((a, b) => rank[a[0]] - rank[b[0]] || b[2] - a[2]);
  FIX = { out, np, sitemap: '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + pages.map(p => `  <url><loc>${esc(p.url)}</loc></url>\n`).join("") + "</urlset>",
    robots: `User-agent: *\nAllow: /\nSitemap: ${u.origin}/sitemap.xml\n`, jsonld: '<script type="application/ld+json">\n' + JSON.stringify({ "@context": "https://schema.org", "@graph": [{ "@type": "Organization", name: brand, url: u.origin }, { "@type": "WebSite", name: brand, url: u.origin }] }, null, 2) + "\n</script>" };
  return `<h3>1. Problems to fix (most serious first)</h3><table><tr><th>Level</th><th>Problem</th><th>Pages</th></tr>${iss.map(i => `<tr><td class="${i[0]}">${i[0]}</td><td>${esc(i[1])}</td><td>${i[2]}</td></tr>`).join("") || "<tr><td colspan=3>No problems found</td></tr>"}</table>
  <h3>2. New title and description for each page</h3><table><tr><th>Page and keyword</th><th>Title</th><th>Meta description</th></tr>${out.map(p => `<tr><td>${esc(p.url)}<br><span class="tag">${esc(p.kw || "no keyword match")}</span></td><td><div class="old">${esc(p.title_now || "none")}</div><div class="new">${esc(p.title_new)}</div></td><td><div class="old">${esc(p.desc_now || "none")}</div><div class="new">${esc(p.desc_new)}</div></td></tr>`).join("")}</table>
  <h3>3. Internal links to add</h3><table>${out.filter(p => p.links.length).map(p => `<tr><td>On ${esc(p.url)}</td><td>${p.links.map(l => `link "${esc(l.anchor)}" to ${esc(l.to)}`).join("<br>")}</td></tr>`).join("") || "<tr><td>No suggestions</td></tr>"}</table>
  <h3>4. New pages to create</h3><table><tr><th>Keyword</th><th>Suggested title</th><th>URL</th></tr>${np.map(n => `<tr><td>${esc(n.keyword)}</td><td>${esc(n.title)}</td><td>${esc(n.slug)}</td></tr>`).join("") || "<tr><td colspan=3>All keywords are covered</td></tr>"}</table>
  <h3>5. Files to add to your site</h3><button class="go" onclick="dl('sitemap.xml',FIX.sitemap)">Download sitemap.xml</button><button class="go" onclick="dl('robots.txt',FIX.robots)">Download robots.txt</button><button class="go" onclick="dl('schema.html',FIX.jsonld)">Download schema markup</button><button class="go alt" onclick="dlPlan()">Download full plan (.txt)</button>`;
});
function dlPlan() {
  let t = "SEO PLAN\n\n"; FIX.out.forEach(p => { t += `PAGE: ${p.url}\nKeyword: ${p.kw}\nTitle: ${p.title_new}\nDescription: ${p.desc_new}\n${p.links.map(l => `Add link: "${l.anchor}" -> ${l.to}`).join("\n")}\n\n` });
  dl("seo-plan.txt", t + "NEW PAGES\n" + FIX.np.map(n => `${n.slug}  |  ${n.title}`).join("\n"));
}
const kw = () => run("k_out", async () => { const ks = await expand($("#k_seed").value.trim()), q = ks.filter(isQ); return `<h3>Question keywords (${q.length})</h3>${tags(q)}<h3>All keyword ideas (${ks.length})</h3>${tags(ks)}` });
const gap = () => run("g_out", async () => {
  const site = await crawl(norm($("#g_url").value), 10), st = site.map(p => p.text).join(" ").toLowerCase(), comp = {}, heads = [];
  for (const c of lines($("#g_comp").value).slice(0, 3)) for (const p of await crawl(norm(c), 5)) { terms(p.text).forEach(([t, n]) => comp[t] = (comp[t] || 0) + n); heads.push(...p.h1, ...p.h2) }
  const miss = Object.entries(comp).sort((a, b) => b[1] - a[1]).slice(0, 400).filter(([t, n]) => n >= 3 && !st.includes(t)).slice(0, 40);
  return `<h3>Terms competitors use that your site does not</h3>${tags(miss.map(m => m[0] + " (" + m[1] + ")")) || "No gaps found"}<h3>Competitor headings</h3><ul>${[...new Set(heads)].slice(0, 40).map(x => `<li>${esc(x)}</li>`).join("")}</ul>`;
});
const outline = () => run("o_out", async () => {
  const k = $("#o_kw").value.trim(), ks = await expand(k), qn = ks.filter(isQ).slice(0, 8), rel = ks.filter(x => !qn.includes(x) && x !== k).slice(0, 12), c1 = s => s[0].toUpperCase() + s.slice(1);
  const h2 = [`What is ${k}?`, ...qn.slice(0, 5).map(q => c1(q) + "?"), `Best tips for ${k}`, `Common mistakes in ${k}`, "Conclusion and next steps"];
  return `<h3>Title</h3><p>${esc(cap(k))}: Complete Guide (${new Date().getFullYear()})</p><h3>H1</h3><p>${esc(cap(k))}</p><h3>Meta description</h3><p>Learn everything about ${esc(k)}: key tips, common questions and expert advice in one complete guide.</p><h3>H2 sections</h3><ol>${h2.map(x => `<li>${esc(x)}</li>`).join("")}</ol><h3>FAQ</h3>${tags(qn.slice(0, 5))}<h3>Related keywords to use</h3>${tags(rel)}<p class="mute">Target length: 1200-1800 words</p>`;
});
const HK = () => "seo_rank_" + sess().email, hist = () => JSON.parse(localStorage.getItem(HK()) || "[]");
const rank = () => run("r_out", async () => {
  const dom = $("#r_dom").value.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase().trim(), res = [], h = hist();
  for (const k of lines($("#r_kw").value).slice(0, 5)) {
    let pos = -1;
    try {
      const d = new DOMParser().parseFromString((await api("search", { q: k })).html, "text/html");
      const urls = [...d.querySelectorAll("a.result__a")].map(a => { const m = (a.getAttribute("href") || "").match(/uddg=([^&]+)/); return m ? decodeURIComponent(m[1]) : a.getAttribute("href") || "" });
      const i = urls.findIndex(u => { try { return new URL(u).host.toLowerCase().includes(dom) } catch (e) { return false } }); pos = i < 0 ? 0 : i + 1;
    } catch (e) { if (/limit/i.test(e.message)) throw e }
    res.push([k, pos]); h.unshift([new Date().toISOString().slice(0, 16).replace("T", " "), dom, k, pos]);
  }
  localStorage.setItem(HK(), JSON.stringify(h.slice(0, 200)));
  return `<table><tr><th>Keyword</th><th>Position</th></tr>${res.map(([k, p]) => `<tr><td>${esc(k)}</td><td>${p > 0 ? p : p < 0 ? "Check failed" : "Not in top results"}</td></tr>`).join("")}</table>`;
});
const showHist = () => run("r_out", async () => `<table><tr><th>Time</th><th>Domain</th><th>Keyword</th><th>Position</th></tr>${hist().map(x => `<tr>${x.map(c => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</table>`);
