import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import type { Session, WebContents } from "electron";
import { impostaPermessi } from "../src/permessi";

type Check = Parameters<Session["setPermissionCheckHandler"]>[0];
type Request = Parameters<Session["setPermissionRequestHandler"]>[0];
type Device = Parameters<Session["setDevicePermissionHandler"]>[0];
type Display = Parameters<Session["setDisplayMediaRequestHandler"]>[0];
const pagina = "/tmp/clotch fixture #1/renderer/index.html";
const url = pathToFileURL(pagina).href;
const dettagli = { isMainFrame: true, requestingUrl: url + "?sessione=s%201#messaggio" };

function sessioneFinta() {
  const installati: string[] = [];
  let check: NonNullable<Check>, request: NonNullable<Request>, device: NonNullable<Device>, display: NonNullable<Display>;
  let displayOptions: unknown;
  const fake = {
    setPermissionCheckHandler(h: NonNullable<Check>) { installati.push("check"); check = h; },
    setPermissionRequestHandler(h: NonNullable<Request>) { installati.push("request"); request = h; },
    setDevicePermissionHandler(h: NonNullable<Device>) { installati.push("device"); device = h; },
    setDisplayMediaRequestHandler(h: NonNullable<Display>, o: unknown) { installati.push("display"); display = h; displayOptions = o; },
  };
  const ses = fake as unknown as Session;
  return { ses, installati, options: () => displayOptions,
    check: (wc: WebContents | null, p: string, d = dettagli) => check(wc, p as Parameters<NonNullable<Check>>[1], "null", d),
    request(wc: WebContents, p: string, d = dettagli) {
      const risposte: boolean[] = [];
      request(wc, p as Parameters<NonNullable<Request>>[1], ok => risposte.push(ok), d);
      assert.equal(risposte.length, 1, "ogni richiesta riceve una sola risposta");
      return risposte[0];
    },
    device: (type: string) => device({ deviceType: type, origin: url, device: {} } as Parameters<NonNullable<Device>>[0]),
    display() {
      const risposte: unknown[] = [];
      display({ frame: null, securityOrigin: url, audioRequested: true, videoRequested: true, userGesture: true }, r => risposte.push(r));
      assert.deepEqual(risposte, [null], "nessuna sorgente o selettore per display/media");
    },
  };
}

function contenuto(ses: Session) {
  const frame = { url: dettagli.requestingUrl };
  return { session: ses, mainFrame: frame, getURL: () => frame.url, isDestroyed: () => false } as unknown as WebContents;
}

test("permessi: scrittura testo legittima nelle due finestre della sessione, installazione idempotente", () => {
  const s = sessioneFinta(), a = contenuto(s.ses), b = contenuto(s.ses);
  impostaPermessi(a, pagina); impostaPermessi(b, pagina); impostaPermessi(a, pagina);
  assert.deepEqual(s.installati, ["check", "request", "device", "display"]);
  for (const wc of [a, b]) {
    assert.equal(s.check(wc, "clipboard-sanitized-write"), true);
    assert.equal(s.request(wc, "clipboard-sanitized-write"), true);
  }
});

test("permessi: rifiuto clipboard per finestre, frame, origini e documenti non autorizzati", () => {
  const s = sessioneFinta(), wc = contenuto(s.ses);
  impostaPermessi(wc, pagina);
  const estraneo = contenuto(s.ses);
  for (const item of [estraneo, null]) assert.equal(s.check(item, "clipboard-sanitized-write"), false);
  assert.equal(s.request(estraneo, "clipboard-sanitized-write"), false);
  for (const d of [{ ...dettagli, isMainFrame: false }, { ...dettagli, requestingUrl: "" },
    ...["https://example.org/", url + ".evil", url + "/evil", "file:///tmp/evil/index.html", "file://estraneo/tmp/index.html", "about:blank", "non URL"].map(requestingUrl => ({ ...dettagli, requestingUrl }))]) {
    assert.equal(s.check(wc, "clipboard-sanitized-write", d), false);
    assert.equal(s.request(wc, "clipboard-sanitized-write", d), false);
  }
  for (const modifica of [
    { getURL: () => "https://example.org/" }, { mainFrame: { url: "file:///tmp/estraneo.html" } },
    { isDestroyed: () => true }, { getURL: () => { throw Error("navigato"); } }, { session: sessioneFinta().ses },
  ]) {
    const originale = Object.getOwnPropertyDescriptors(wc);
    Object.assign(wc, modifica);
    assert.equal(s.check(wc, "clipboard-sanitized-write"), false);
    assert.equal(s.request(wc, "clipboard-sanitized-write"), false);
    Object.defineProperties(wc, originale);
  }
  assert.equal(s.check(wc, "clipboard-sanitized-write"), true, "il rifiuto non revoca altre copie legittime");
});

test("permessi: deny anche per finestre fidate, media/display distinti e tipi futuri", () => {
  const s = sessioneFinta(), wc = contenuto(s.ses);
  impostaPermessi(wc, pagina);
  for (const p of ["media", "display-capture", "clipboard-read", "clipboard-write", "clipboard-unsanitized-write", "deprecated-sync-clipboard-read",
    "notifications", "geolocation", "hid", "usb", "serial", "midi", "fullscreen", "pointerLock", "local-fonts", "permesso-futuro"]) {
    assert.equal(s.check(wc, p), false, p);
    assert.equal(s.request(wc, p), false, p);
  }
  for (const mediaType of ["audio", "video", "unknown"]) {
    assert.equal(s.check(wc, "media", { ...dettagli, mediaType } as typeof dettagli), false);
    assert.equal(s.request(wc, "media", { ...dettagli, mediaTypes: [mediaType] } as typeof dettagli), false);
  }
  for (const type of ["hid", "usb", "serial"]) assert.equal(s.device(type), false, type);
  assert.deepEqual(s.options(), { useSystemPicker: false });
  s.display();
  console.log("PERMESSI_DEFAULT_DENY_CLIPBOARD_MAIN_ONLY_OK");
});
