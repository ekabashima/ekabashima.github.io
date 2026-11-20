// Service worker do Painel Rally: guarda o app no celular para abrir sem internet.
// A cada versão publicada, mude VERSAO para o celular trocar o cache antigo.
const VERSAO = "2026-11-20.1";
const CACHE_APP = "painel-rally-app-" + VERSAO;
const CACHE_FONTES = "painel-rally-fontes";
const ARQUIVOS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icones/icone-180.png",
  "./icones/icone-192.png",
  "./icones/icone-512.png",
  "./icones/icone-maskable-512.png",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE_APP).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(nomes => Promise.all(nomes.filter(n => n.startsWith("painel-rally-app-") && n !== CACHE_APP).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

// Rede com prazo: no carro, sinal fraco não pode segurar a abertura do app
function comPrazo(promessa, ms) {
  return new Promise((ok, falha) => {
    const t = setTimeout(() => falha(new Error("prazo")), ms);
    promessa.then(r => { clearTimeout(t); ok(r); }, e => { clearTimeout(t); falha(e); });
  });
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Fontes do Google: usa a cópia guardada e atualiza por trás
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.open(CACHE_FONTES).then(async c => {
      const guardada = await c.match(req);
      const rede = fetch(req).then(r => { if (r.ok || r.type === "opaque") c.put(req, r.clone()); return r; }).catch(() => guardada);
      return guardada || rede;
    }));
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Página do app: tenta a versão nova por 3 s; sem rede, abre a guardada
  if (req.mode === "navigate") {
    e.respondWith(
      comPrazo(fetch(req), 3000)
        .then(r => { if (r.ok) caches.open(CACHE_APP).then(c => c.put("./index.html", r.clone())); return r; })
        .catch(() => caches.match("./index.html", { ignoreSearch: true }))
    );
    return;
  }

  // Demais arquivos: cache primeiro
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(r => r || fetch(req).then(resp => {
    if (resp.ok) { const copia = resp.clone(); caches.open(CACHE_APP).then(c => c.put(req, copia)); }
    return resp;
  })));
});
