const g = id => document.getElementById(id);
function buildConfig() {
  const c = { NAME: g("name").value.trim() || "SEO Agent", API_URL: g("url").value.trim(), CONTACT: g("mail").value.trim() || "you@yourdomain.com", ADSENSE_CLIENT: g("ads").value.trim(), ADSENSE_SLOT: g("slot").value.trim() };
  return "// Edit these values. Nothing here is secret.\nwindow.CFG = " + JSON.stringify(c, null, 2) + ";\n";
}
const URL_OK = /^https:\/\/script\.google\.com\/(a\/macros\/[^/]+\/|macros\/)s\/[\w-]+\/exec$/;
g("test").onclick = async () => {
  const u = g("url").value.trim(), m = g("msg");
  if (!URL_OK.test(u)) { m.className = "err"; m.textContent = "That does not look right. It must start with https://script.google.com/macros/s/ and end with /exec"; return }
  m.className = "small"; m.textContent = "Testing...";
  try {
    const j = await (await fetch(u, { method: "POST", body: JSON.stringify({ action: "ping" }) })).json();
    m.className = j.ok ? "new" : "err"; m.textContent = j.ok ? "Connected. Now download config.js below." : "The server answered, but not as expected. Re-deploy a New version of Code.gs.";
  } catch (e) { m.className = "err"; m.textContent = "Could not connect. In Apps Script open Deploy > Manage deployments, set Who has access to Anyone, deploy a New version and try again." }
};
g("make").onclick = () => {
  if (!URL_OK.test(g("url").value.trim())) { g("msg").className = "err"; g("msg").textContent = "Paste a valid Web app URL first."; return }
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([buildConfig()], { type: "text/javascript" })); a.download = "config.js"; a.click();
};
