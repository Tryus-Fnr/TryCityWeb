/**
 * Die Overlay-Seite für OBS.
 *
 * Absichtlich eine Route und keine page.tsx: das Wurzel-Layout der Website
 * hängt Navbar, Breadcrumbs, Footer und Cookie-Banner um *jede* Seite, und im
 * App Router kommt man da ohne Umbau der ganzen Ordnerstruktur nicht heraus.
 * Ein Overlay mit Navigationsleiste über dem Gameplay will niemand.
 *
 * Deshalb hier eine eigenständige HTML-Seite: kein React, keine globals.css,
 * garantiert durchsichtiger Hintergrund, lädt sofort.
 *
 *   https://trycity.net/alerts?key=DEIN_KEY
 *
 * Zusätzliche Schalter (alle optional):
 *   &volume=0.6        Lautstärke 0–1 (Standard 0.7)
 *   &duration=8000     Anzeigedauer je Alert in Millisekunden
 *   &sound=/pfad.mp3   eigene Sounddatei statt /alerts/alert.mp3
 *   &debug=1           Verbindungsstatus einblenden (nicht für den Stream)
 */

export const dynamic = "force-dynamic";

const HTML = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>TryCity Alerts</title>
<meta name="robots" content="noindex, nofollow">
<style>
  html, body {
    margin: 0; padding: 0; height: 100%;
    background: transparent;           /* OBS blendet das aus */
    overflow: hidden;
    font-family: "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  }
  #stage {
    position: fixed; inset: 0;
    display: flex; justify-content: center; align-items: flex-start;
    padding-top: 60px;
    pointer-events: none;              /* Klicks gehen durch, falls im Browser offen */
  }
  /*
   * Kein Kasten, kein Hintergrund – nur Kopf und Text über dem Gameplay.
   * Lesbarkeit macht deshalb allein der Schlagschatten weiter unten: ohne den
   * verschwindet weiße Schrift in einer verschneiten Landschaft.
   */
  #card {
    display: flex; align-items: center; gap: 18px;
    opacity: 0;
    transform: translateY(-45px) scale(.94);
    visibility: hidden;
  }
  #card.show {
    visibility: visible;
    opacity: 1;
    transform: translateY(0) scale(1);
    /* Leichtes Überschwingen beim Einfliegen */
    transition: opacity .28s ease-out, transform .5s cubic-bezier(.18,1.4,.4,1);
  }
  #card.hide {
    visibility: visible;
    opacity: 0;
    transform: translateY(-14px) scale(.97);
    transition: opacity .45s ease-in, transform .45s ease-in;
  }
  /* Kopf links neben dem Text, in Minecraft-Optik ohne Weichzeichnen */
  #head {
    width: 80px; height: 80px; flex: 0 0 auto;
    image-rendering: pixelated;
    filter: drop-shadow(0 3px 7px rgba(0,0,0,.9));
  }
  #head.gone { display: none; }
  #lines { display: flex; flex-direction: column; gap: 4px; }
  #title {
    font-size: 32px; font-weight: 800; color: #fff; line-height: 1.15;
    text-shadow: 0 2px 4px rgba(0,0,0,.95), 0 0 3px rgba(0,0,0,1), 0 0 16px rgba(0,0,0,.7);
    white-space: nowrap;
  }
  #title .name { color: #fbbf24; }
  #products {
    font-size: 22px; font-weight: 700; color: #f5f5f5;
    text-shadow: 0 2px 4px rgba(0,0,0,.95), 0 0 3px rgba(0,0,0,1), 0 0 16px rgba(0,0,0,.7);
  }
  #debug {
    position: fixed; left: 10px; bottom: 8px;
    font: 12px/1.4 monospace; color: #9ca3af;
    background: rgba(0,0,0,.6); padding: 4px 9px; border-radius: 6px;
    display: none;
  }
</style>
</head>
<body>
<div id="stage">
  <div id="card">
    <img id="head" alt="">
    <div id="lines">
      <div id="title"></div>
      <div id="products"></div>
    </div>
  </div>
</div>
<div id="debug"></div>

<script>
(function () {
  var p          = new URLSearchParams(location.search);
  var KEY        = p.get("key") || "";
  var VOLUME     = Math.min(1, Math.max(0, parseFloat(p.get("volume") || "0.7")));
  var DURATION   = parseInt(p.get("duration") || "8000", 10);
  var SOUND      = p.get("sound") || "/alerts/alert.mp3";
  var DEBUG      = p.get("debug") === "1";

  var card     = document.getElementById("card");
  var head     = document.getElementById("head");
  var title    = document.getElementById("title");
  var products = document.getElementById("products");
  var dbg      = document.getElementById("debug");

  if (DEBUG) dbg.style.display = "block";
  function status(t) { if (DEBUG) dbg.textContent = t; }

  // --- Sound ---------------------------------------------------------------
  // OBS erlaubt automatisches Abspielen. Ein normaler Browser nicht: dort
  // schlägt play() ohne vorherigen Klick fehl, deshalb der Entsperr-Klick.
  var audio = new Audio(SOUND);
  audio.volume = VOLUME;
  audio.preload = "auto";
  document.addEventListener("click", function unlock() {
    audio.play().then(function () { audio.pause(); audio.currentTime = 0; }).catch(function () {});
    document.removeEventListener("click", unlock);
  });

  // --- Warteschlange -------------------------------------------------------
  // Ohne die überschreiben sich zwei Käufe kurz hintereinander gegenseitig
  // und man hört zwei Sounds übereinander.
  var queue = [];
  var busy  = false;

  function next() {
    if (busy || queue.length === 0) return;
    busy = true;
    show(queue.shift());
  }

  function show(a) {
    // Abo-Verlängerung ist kein Neukauf – das soll man auch sehen
    var verb = a.kind === "renewal" ? " hat verlängert!" : " hat gekauft!";
    title.innerHTML = '<span class="name"></span>' + verb;
    title.querySelector(".name").textContent = a.buyer;
    products.textContent = (a.products || []).join(", ");
    // Der Preis kommt im Ereignis mit (steht im Log), wird aber bewusst
    // nicht eingeblendet – im Stream geht niemanden an, was etwas gekostet hat.

    // Spielerkopf – fällt weg, wenn der Name kein Minecraft-Konto ist
    head.classList.remove("gone");
    head.onerror = function () { head.classList.add("gone"); };
    head.src = "https://mc-heads.net/avatar/" + encodeURIComponent(a.buyer) + "/144";

    audio.currentTime = 0;
    audio.play().catch(function () { status("Sound blockiert (im Browser normal)"); });

    card.classList.remove("hide");
    card.classList.add("show");

    setTimeout(function () {
      card.classList.remove("show");
      card.classList.add("hide");
      setTimeout(function () {
        card.classList.remove("hide");
        busy = false;
        next();
      }, 500);
    }, DURATION);
  }

  // --- Verbindung ----------------------------------------------------------
  // EventSource verbindet nach Abbrüchen von allein neu und schickt dabei die
  // zuletzt gesehene ID mit – ein Deploy-Neustart kostet damit keinen Alert.
  var es = new EventSource("/api/alerts/stream?key=" + encodeURIComponent(KEY));

  es.onopen = function () { status("verbunden"); };
  es.onmessage = function (e) {
    try {
      queue.push(JSON.parse(e.data));
      next();
    } catch (err) {
      status("kaputtes Ereignis: " + err);
    }
  };
  es.onerror = function () {
    // Kein manuelles Neuverbinden nötig, das macht der Browser selbst.
    status("getrennt – verbinde neu …");
  };
})();
</script>
</body>
</html>
`;

export async function GET() {
  return new Response(HTML, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
