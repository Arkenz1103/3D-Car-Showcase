// @ts-nocheck
import { CanvasTexture, DataTexture, RGBAFormat, RepeatWrapping, SRGBColorSpace } from "three";

export let studioTextureCache = null;

export function makeStudioTextures() {
  if (studioTextureCache) return studioTextureCache;
  const Q = 128,
    A = document.createElement("canvas"),
    g = document.createElement("canvas"),
    I = document.createElement("canvas");
  ((A.width = g.width = I.width = Q), (A.height = g.height = I.height = Q));
  const C = A.getContext("2d"),
    E = g.getContext("2d"),
    e = I.getContext("2d");
  ((C.fillStyle = "#141619"),
    C.fillRect(0, 0, Q, Q),
    (E.fillStyle = "rgb(128,128,255)"),
    E.fillRect(0, 0, Q, Q),
    (e.fillStyle = "#484848"),
    e.fillRect(0, 0, Q, Q));
  const o = Q / 4;
  for (let R = 0; R < 4; R++)
    for (let z = 0; z < 4; z++) {
      const IA = (z + R) % 4 < 2,
        iA = z * o,
        DA = R * o,
        H = IA ? C.createLinearGradient(iA, DA, iA + o, DA) : C.createLinearGradient(iA, DA, iA, DA + o);
      (H.addColorStop(0, "#101215"),
        H.addColorStop(0.28, "#292d34"),
        H.addColorStop(0.5, "#3a404a"),
        H.addColorStop(0.72, "#262a31"),
        H.addColorStop(1, "#0e1013"),
        (C.fillStyle = H),
        C.fillRect(iA + 1, DA + 1, o - 2, o - 2));
      const wA = IA ? E.createLinearGradient(iA, DA, iA + o, DA) : E.createLinearGradient(iA, DA, iA, DA + o);
      (IA
        ? (wA.addColorStop(0, "rgb(92,128,245)"),
          wA.addColorStop(0.5, "rgb(128,128,255)"),
          wA.addColorStop(1, "rgb(164,128,245)"))
        : (wA.addColorStop(0, "rgb(128,92,245)"),
          wA.addColorStop(0.5, "rgb(128,128,255)"),
          wA.addColorStop(1, "rgb(128,164,245)")),
        (E.fillStyle = wA),
        E.fillRect(iA + 1, DA + 1, o - 2, o - 2),
        (e.fillStyle = IA ? "#323232" : "#565656"),
        e.fillRect(iA + 1, DA + 1, o - 2, o - 2));
    }
  const l = (R, z, IA, iA = !1) => (
      (R.wrapS = R.wrapT = RepeatWrapping),
      R.repeat.set(z, IA),
      (R.anisotropy = 8),
      iA && (R.colorSpace = SRGBColorSpace),
      (R.needsUpdate = !0),
      R
    ),
    M = l(new CanvasTexture(A), 22, 22, !0),
    n = l(new CanvasTexture(g), 22, 22),
    r = l(new CanvasTexture(I), 22, 22),
    h = 128,
    V = new Uint8Array(h * h * 4);
  let P = 19290529;
  const y = () => ((P = (P * 1664525 + 1013904223) >>> 0), P / 4294967296);
  for (let R = 0; R < h * h; R++) {
    const z = (y() - 0.5) * 0.36,
      IA = (y() - 0.5) * 0.36;
    ((V[R * 4] = Math.round((z * 0.5 + 0.5) * 255)),
      (V[R * 4 + 1] = Math.round((IA * 0.5 + 0.5) * 255)),
      (V[R * 4 + 2] = 250),
      (V[R * 4 + 3] = 255));
  }
  const j = new DataTexture(V, h, h, RGBAFormat);
  l(j, 96, 96);
  const u = new Uint8Array(h * h * 4);
  for (let R = 0; R < h * h; R++) {
    const z = (y() - 0.5) * 0.85,
      IA = (y() - 0.5) * 0.85;
    ((u[R * 4] = Math.round((z * 0.5 + 0.5) * 255)),
      (u[R * 4 + 1] = Math.round((IA * 0.5 + 0.5) * 255)),
      (u[R * 4 + 2] = 235),
      (u[R * 4 + 3] = 255));
  }
  const K = new DataTexture(u, h, h, RGBAFormat);
  l(K, 42, 42);
  const U = 512,
    p = document.createElement("canvas"),
    G = document.createElement("canvas");
  ((p.width = G.width = U), (p.height = G.height = U));
  const q = p.getContext("2d"),
    N = G.getContext("2d");
  ((q.fillStyle = "#3a3c40"), q.fillRect(0, 0, U, U), (N.fillStyle = "#5a5a5a"), N.fillRect(0, 0, U, U));
  const W = U / 2,
    m = U / 2;
  for (let R = 70; R < 245; R += 3)
    ((q.strokeStyle = R % 6 === 0 ? "rgba(88,92,98,0.45)" : "rgba(38,40,44,0.45)"),
      (q.lineWidth = 1.5),
      q.beginPath(),
      q.arc(W, m, R, 0, Math.PI * 2),
      q.stroke());
  for (let R = 0; R < 30; R++) {
    const z = (R / 30) * Math.PI * 2;
    for (let IA = 0; IA < 5; IA++) {
      const iA = 112 + IA * 26,
        DA = z + IA * 0.045,
        H = W + Math.cos(DA) * iA,
        wA = m + Math.sin(DA) * iA;
      ((q.fillStyle = "#0b0c0e"),
        q.beginPath(),
        q.arc(H, wA, 3.6, 0, Math.PI * 2),
        q.fill(),
        (N.fillStyle = "#dcdcdc"),
        N.beginPath(),
        N.arc(H, wA, 4.2, 0, Math.PI * 2),
        N.fill());
    }
  }
  ((q.fillStyle = "#1d2025"), q.beginPath(), q.arc(W, m, 96, 0, Math.PI * 2), q.fill());
  const X = new CanvasTexture(p);
  ((X.colorSpace = SRGBColorSpace), (X.anisotropy = 8), (X.needsUpdate = !0));
  const L = new CanvasTexture(G);
  ((L.anisotropy = 8), (L.needsUpdate = !0));
  const gA = 512,
    QA = document.createElement("canvas");
  QA.width = QA.height = gA;
  const AA = QA.getContext("2d");
  ((AA.fillStyle = "#2b2d30"), AA.fillRect(0, 0, gA, gA));
  for (let R = 0; R < 2600; R++) {
    const z = y() * gA,
      IA = y() * gA,
      iA = 4 + y() * 34,
      DA = 0.025 + y() * 0.055;
    ((AA.fillStyle = y() > 0.5 ? `rgba(96,100,108,${DA})` : `rgba(18,20,24,${DA})`),
      AA.beginPath(),
      AA.arc(z, IA, iA, 0, Math.PI * 2),
      AA.fill());
  }
  ((AA.strokeStyle = "rgba(110,115,125,0.22)"), (AA.lineWidth = 1.5), AA.strokeRect(1, 1, gA - 2, gA - 2));
  const CA = l(new CanvasTexture(QA), 14, 14);
  return (
    (studioTextureCache = {
      carbonAlbedo: M,
      carbonNormal: n,
      carbonRoughness: r,
      flakeNormal: j,
      wrinkleNormal: K,
      rotorAlbedo: X,
      rotorRoughness: L,
      floorRoughness: CA,
    }),
    studioTextureCache
  );
}

export let floorTextureCache = null;

export function makeFloorTextures() {
  if (floorTextureCache) return floorTextureCache;
  let Q = 20190530;
  const A = () => ((Q = (Q * 1664525 + 1013904223) >>> 0), Q / 4294967296),
    g = 1024,
    I = document.createElement("canvas"),
    C = document.createElement("canvas");
  I.width = I.height = C.width = C.height = g;
  const E = I.getContext("2d"),
    e = C.getContext("2d");
  ((E.fillStyle = "#4a4c50"), E.fillRect(0, 0, g, g), (e.fillStyle = "#9a9a9a"), e.fillRect(0, 0, g, g));
  for (let q = 0; q < 90; q++) {
    const N = A() * g,
      W = A() * g,
      m = 40 + A() * 190,
      X = A() > 0.45,
      L = E.createRadialGradient(N, W, 0, N, W, m);
    (L.addColorStop(0, X ? `rgba(28,30,34,${0.05 + A() * 0.12})` : `rgba(150,152,156,${0.03 + A() * 0.07})`),
      L.addColorStop(1, "rgba(0,0,0,0)"),
      (E.fillStyle = L),
      E.beginPath(),
      E.arc(N, W, m, 0, Math.PI * 2),
      E.fill());
  }
  const o = E.getImageData(0, 0, g, g),
    l = o.data;
  for (let q = 0; q < l.length; q += 4) {
    const N = (A() - 0.5) * 26;
    ((l[q] = Math.max(0, Math.min(255, l[q] + N))),
      (l[q + 1] = Math.max(0, Math.min(255, l[q + 1] + N))),
      (l[q + 2] = Math.max(0, Math.min(255, l[q + 2] + N))));
  }
  E.putImageData(o, 0, 0);
  const M = g / 4;
  ((E.strokeStyle = "rgba(22,24,27,0.85)"), (e.strokeStyle = "rgba(190,190,190,0.95)"));
  for (let q = 1; q < 4; q++)
    ((E.lineWidth = 5),
      (e.lineWidth = 7),
      E.beginPath(),
      E.moveTo(q * M, 0),
      E.lineTo(q * M, g),
      E.stroke(),
      e.beginPath(),
      e.moveTo(q * M, 0),
      e.lineTo(q * M, g),
      e.stroke(),
      E.beginPath(),
      E.moveTo(0, q * M),
      E.lineTo(g, q * M),
      E.stroke(),
      e.beginPath(),
      e.moveTo(0, q * M),
      e.lineTo(g, q * M),
      e.stroke());
  ((E.strokeStyle = "rgba(150,153,158,0.16)"), (E.lineWidth = 2));
  for (let q = 1; q < 4; q++) (E.beginPath(), E.moveTo(q * M + 4, 0), E.lineTo(q * M + 4, g), E.stroke());
  for (let q = 0; q < 7; q++) {
    let N = A() * g,
      W = A() * g;
    ((E.strokeStyle = "rgba(24,25,28,0.55)"), (E.lineWidth = 1.4), E.beginPath(), E.moveTo(N, W));
    for (let m = 0; m < 22; m++) ((N += (A() - 0.5) * 46), (W += (A() - 0.35) * 46), E.lineTo(N, W));
    E.stroke();
  }
  for (let q = 0; q < 5; q++) {
    const N = A() * g,
      W = A() * g;
    ((E.strokeStyle = `rgba(16,17,19,${0.1 + A() * 0.12})`),
      (E.lineWidth = 3 + A() * 7),
      E.beginPath(),
      E.arc(N, W, 60 + A() * 130, A() * Math.PI, A() * Math.PI + 0.7),
      E.stroke());
  }
  for (let q = 0; q < 9; q++) {
    const N = A() * g,
      W = A() * g,
      m = 12 + A() * 46,
      X = E.createRadialGradient(N, W, 0, N, W, m);
    (X.addColorStop(0, "rgba(18,19,22,0.42)"),
      X.addColorStop(0.7, "rgba(24,25,28,0.16)"),
      X.addColorStop(1, "rgba(0,0,0,0)"),
      (E.fillStyle = X),
      E.beginPath(),
      E.arc(N, W, m, 0, Math.PI * 2),
      E.fill());
    const L = e.createRadialGradient(N, W, 0, N, W, m);
    (L.addColorStop(0, "rgba(60,60,60,0.55)"),
      L.addColorStop(1, "rgba(0,0,0,0)"),
      (e.fillStyle = L),
      e.beginPath(),
      e.arc(N, W, m * 1.1, 0, Math.PI * 2),
      e.fill());
  }
  const n = (q, N, W = !1) => (
      (q.wrapS = q.wrapT = RepeatWrapping),
      q.repeat.set(N, N),
      (q.anisotropy = 8),
      W && (q.colorSpace = SRGBColorSpace),
      (q.needsUpdate = !0),
      q
    ),
    r = n(new CanvasTexture(I), 7, !0),
    h = n(new CanvasTexture(C), 7),
    V = 512,
    P = document.createElement("canvas"),
    y = document.createElement("canvas");
  P.width = P.height = y.width = y.height = V;
  const j = P.getContext("2d"),
    u = y.getContext("2d");
  ((j.fillStyle = "#5c6067"), j.fillRect(0, 0, V, V), (u.fillStyle = "#6e6e6e"), u.fillRect(0, 0, V, V));
  const K = V / 2,
    U = V / 2;
  for (let q = 4; q < V / 2; q += 2)
    ((j.strokeStyle = q % 8 === 0 ? "rgba(150,155,163,0.28)" : "rgba(60,63,68,0.25)"),
      (j.lineWidth = 1),
      j.beginPath(),
      j.arc(K, U, q, 0, Math.PI * 2),
      j.stroke(),
      (u.strokeStyle = q % 10 === 0 ? "rgba(120,120,120,0.5)" : "rgba(150,150,150,0.18)"),
      u.beginPath(),
      u.arc(K, U, q, 0, Math.PI * 2),
      u.stroke());
  for (let q = 0; q < 220; q++) {
    const N = A() * Math.PI * 2,
      W = 30 + A() * 220;
    ((j.strokeStyle = `rgba(${A() > 0.5 ? "180,185,192" : "40,43,47"},${0.03 + A() * 0.06})`),
      (j.lineWidth = 1),
      j.beginPath(),
      j.moveTo(K + Math.cos(N) * 26, U + Math.sin(N) * 26),
      j.lineTo(K + Math.cos(N) * W, U + Math.sin(N) * W),
      j.stroke());
  }
  ((j.strokeStyle = "rgba(20,22,25,0.9)"),
    (j.lineWidth = 10),
    j.beginPath(),
    j.arc(K, U, V / 2 - 8, 0, Math.PI * 2),
    j.stroke(),
    (j.fillStyle = "#2d3036"),
    j.beginPath(),
    j.arc(K, U, 58, 0, Math.PI * 2),
    j.fill(),
    (j.strokeStyle = "rgba(170,175,182,0.4)"),
    (j.lineWidth = 2),
    j.beginPath(),
    j.arc(K, U, 58, 0, Math.PI * 2),
    j.stroke());
  const p = new CanvasTexture(P);
  ((p.colorSpace = SRGBColorSpace), (p.anisotropy = 8), (p.needsUpdate = !0));
  const G = new CanvasTexture(y);
  return (
    (G.anisotropy = 8),
    (G.needsUpdate = !0),
    (floorTextureCache = {
      concreteAlbedo: r,
      concreteRoughness: h,
      platformAlbedo: p,
      platformRoughness: G,
    }),
    floorTextureCache
  );
}

export function drawDashboardDisplay(Q, A, g) {
  const I = (Q.width = 1024),
    C = (Q.height = 512),
    E = Q.getContext("2d");
  ((E.fillStyle = "#06080c"), E.fillRect(0, 0, I, C));
  const o = {
      edrive: "#38BDF8",
      hybrid: "#34D399",
      performance: "#F5C518",
      qualify: "#DC1A22",
    }[A],
    l = E.createRadialGradient(I / 2, C * 0.54, 20, I / 2, C * 0.54, 220);
  (l.addColorStop(0, "rgba(245, 197, 24, 0.22)"),
    l.addColorStop(0.7, "rgba(220, 26, 34, 0.08)"),
    l.addColorStop(1, "rgba(6, 8, 12, 0)"),
    (E.fillStyle = l),
    E.fillRect(0, 0, I, C),
    (E.strokeStyle = "#F5C518"),
    (E.lineWidth = 18),
    E.beginPath(),
    E.arc(I / 2, C * 0.56, 152, Math.PI * 0.8, Math.PI * 1.95),
    E.stroke(),
    (E.strokeStyle = "#DC1A22"),
    (E.lineWidth = 18),
    E.beginPath(),
    E.arc(I / 2, C * 0.56, 152, Math.PI * 1.95, Math.PI * 2.2),
    E.stroke(),
    (E.fillStyle = "#FFFFFF"),
    (E.font = "700 92px 'Space Grotesk', sans-serif"),
    (E.textAlign = "center"),
    E.fillText(A === "edrive" ? "D" : g > 10 ? "4" : "1", I / 2, C * 0.57),
    (E.fillStyle = "#F5C518"),
    (E.font = "600 44px 'JetBrains Mono', monospace"),
    E.fillText(`${Math.round(g)} km/h`, I / 2, C * 0.74),
    (E.textAlign = "left"),
    (E.fillStyle = o),
    (E.font = "700 28px 'JetBrains Mono', monospace"),
    E.fillText(`eMANETTINO // ${A.toUpperCase()}`, 68, 118),
    (E.fillStyle = "#94A3B8"),
    (E.font = "500 22px 'JetBrains Mono', monospace"),
    E.fillText("HV BATTERY  7.9 kWh [94%]", 68, 174),
    E.fillText(A === "edrive" ? "ICE F154FA  STANDBY" : "ICE F154FA  780 CV READY", 68, 218),
    E.fillText("MGU-K + RAC-e  220 CV", 68, 262),
    (E.textAlign = "right"),
    (E.fillStyle = "#E2E8F0"),
    (E.font = "600 24px 'JetBrains Mono', monospace"),
    E.fillText("SF90 STRADALE", I - 68, 118),
    (E.fillStyle = "#94A3B8"),
    (E.font = "500 21px 'JetBrains Mono', monospace"),
    E.fillText("CCM BRAKES   398 / 360 MM", I - 68, 174),
    E.fillText("TIRES  255/35 · 315/30 R20", I - 68, 218),
    E.fillText("MAX OUTPUT      1,000 CV", I - 68, 262));
}
