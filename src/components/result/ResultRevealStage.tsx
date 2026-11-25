"use client";

// 自己診断の「結果発表」。解析待ち画面が終わって結果ページへ移った直後に、1回だけ出す。
//
//   1. 客席の明かりが落ち、スポットライトの中に「あなたは...」とキャラクターの影が浮かぶ (じらす)
//   2. ぱっと光って舞台がタイプの色に変わり、影が本物のキャラクターになる。タイプ名が1文字ずつ
//      弾んで出て、フェルトの紙吹雪が上がる
//   3. 少し見せてから、名前と絵が結果ページの本来の位置へ着地する
//
// 名前・絵・色は、裏で描き終わっている結果ページ (ResultHero の data-result-hero*) から読む。
// タイプの判定や画像の決め方をここで持たないので、結果ページと食い違わない。
// 着地の位置も結果ページの実物を測って合わせるため、入れ替わりの継ぎ目が見えない。
//
// 画面を押すと先へ進む (じらしの途中なら発表へ、見せている途中なら着地へ)。
import { useEffect, useRef } from "react";

type Box = { left: number; top: number; width: number; height: number };

export type ResultRevealTarget = {
  name: string;
  heroColor: string;
  imageSrc: string;
  imageFit: string;
  nameBox: Box;
  imageBox: Box;
  /** 絵が地面に触れている場所 (絵の枠に対する割合)。測れなかったときは null。 */
  foot: Foot | null;
  nameStyle: {
    fontSize: string;
    fontWeight: string;
    fontFamily: string;
    lineHeight: string;
    letterSpacing: string;
    textAlign: string;
  };
};

const box = (r: DOMRect): Box => ({ left: r.left, top: r.top, width: r.width, height: r.height });

type Foot = { cx: number; bottom: number; width: number };

/**
 * 絵の「足元」を測る: いちばん下の不透明な行と、そのすぐ上までの横の広がり。
 * 絵によって、枠のどこまで描かれているか・どこで地面に触れているかが違う。足元の影を枠の決まった
 * 位置に置くと、絵から離れて宙に浮いたり、絵の端からはみ出したりするので、実物を測って合わせる。
 */
function measureFoot(img: HTMLImageElement, fit: string, boxW: number, boxH: number): Foot | null {
  if (fit !== "contain" || boxW < 1 || boxH < 1) return null;
  try {
    const cw = 96, ch = Math.max(8, Math.round((cw * boxH) / boxW));
    const c = document.createElement("canvas");
    c.width = cw;
    c.height = ch;
    const g = c.getContext("2d", { willReadFrequently: true });
    if (!g) return null;
    // 画面と同じ収め方 (枠の中央に、はみ出さない最大の大きさ) で小さく描く
    const k = Math.min(cw / img.naturalWidth, ch / img.naturalHeight);
    const w = img.naturalWidth * k, h = img.naturalHeight * k;
    g.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
    const alpha = g.getImageData(0, 0, cw, ch).data;
    const solid = (x: number, y: number) => alpha[(y * cw + x) * 4 + 3] > 110;
    // 絵のある行の範囲。きらめきなどの小さな粒だけの行は数えない。
    const need = Math.max(2, Math.round(cw * 0.03));
    let top = -1, bottom = -1;
    for (let y = 0; y < ch; y++) {
      let n = 0;
      for (let x = 0; x < cw; x++) if (solid(x, y)) n++;
      if (n >= need) {
        if (top < 0) top = y;
        bottom = y;
      }
    }
    if (bottom < 0) return null;
    // いちばん下から、絵の高さの1割ぶんを「地面に触れているあたり」とみなす
    const band = Math.max(2, Math.round((bottom - top + 1) * 0.1));
    let left = cw, right = -1;
    for (let y = bottom - band + 1; y <= bottom; y++) {
      for (let x = 0; x < cw; x++) {
        if (!solid(x, y)) continue;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
    if (right < left) return null;
    return { cx: (left + right + 1) / 2 / cw, bottom: (bottom + 1) / ch, width: (right - left + 1) / cw };
  } catch {
    return null; // 読めない画像 (別の配信元など)。影は枠の下寄りの中央に置く。
  }
}

/** 結果ページの最初の画面から、発表に必要なものを読む。まだ描けていなければ null。 */
export function readResultRevealTarget(): ResultRevealTarget | null {
  const hero = document.querySelector<HTMLElement>("[data-result-hero]");
  const nameEl = hero?.querySelector<HTMLElement>("[data-result-hero-name]");
  const img = hero?.querySelector<HTMLImageElement>("[data-result-hero-image] img");
  if (!hero || !nameEl || !img) return null;
  const name = (nameEl.textContent ?? "").trim();
  if (!name || !img.complete || img.naturalWidth === 0) return null;
  if (window.scrollY > 1) window.scrollTo(0, 0);
  const nameBox = box(nameEl.getBoundingClientRect());
  const imageBox = box(img.getBoundingClientRect());
  if (nameBox.width < 8 || imageBox.width < 40) return null;
  const cs = getComputedStyle(nameEl);
  const imageFit = getComputedStyle(img).objectFit || "contain";
  return {
    name,
    heroColor: getComputedStyle(hero).backgroundColor,
    imageSrc: img.currentSrc || img.src,
    imageFit,
    nameBox,
    imageBox,
    foot: measureFoot(img, imageFit, imageBox.width, imageBox.height),
    nameStyle: {
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      fontFamily: cs.fontFamily,
      lineHeight: cs.lineHeight,
      letterSpacing: cs.letterSpacing,
      textAlign: cs.textAlign,
    },
  };
}

// ---- 時間 (ミリ秒) ----
const DARK_MS = 460; // 明かりが落ちる
const SPOT_AT = 360; // スポットライトが点く
const SHADOW_AT = 560; // 影が浮かぶ
const LEAD_AT = 760; // 「あなたは」
const DOT_AT = [1200, 1500, 1800]; // 「...」が1つずつ
const REVEAL_AT = 2560; // 発表
const HOLD_MS = 2500; // 発表してから着地を始めるまで
const SETTLE_MS = 860; // 着地

// 足元の影: 足元の幅に対する広がり、つぶれ具合 (高さ÷幅)、接地の線より上に隠す割合
const GROUND_SPREAD = 1.35;
const GROUND_FLAT = 0.15;
const GROUND_LIFT = 0.56;

function rgbOf(color: string): [number, number, number] {
  const m = color.match(/[\d.]+/g);
  return m && m.length >= 3 ? [Number(m[0]), Number(m[1]), Number(m[2])] : [180, 155, 232];
}
const toward = (c: [number, number, number], to: [number, number, number], k: number): [number, number, number] =>
  [0, 1, 2].map((i) => Math.round(c[i] + (to[i] - c[i]) * k)) as [number, number, number];
const css = (c: [number, number, number], a = 1) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
const WHITE: [number, number, number] = [255, 255, 255];
const BLACK: [number, number, number] = [0, 0, 0];

// 紙やフェルトの地のざらつき。平らな色面に見えないよう、うすく重ねる。
const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.55 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")";

// ---- 紙吹雪 (フェルトの玉・星・紙) ----
// 1つずつ陰影をつけた絵を先に描いておき、それを回しながら落とす。手前は大きく速く、奥は小さく淡く。
type Piece = {
  kind: "felt" | "paper" | "spark" | "dust";
  sprite: HTMLCanvasElement | null;
  x: number; y: number; vx: number; vy: number; depth: number;
  size: number; rot: number; vr: number; flip: number; vflip: number;
  sway: number; swayAmp: number; born: number; life: number;
};

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D | null] {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return [c, c.getContext("2d")];
}

/** フェルトの玉: 左上から光が当たった、毛羽のある丸。 */
function pomSprite(color: [number, number, number]): HTMLCanvasElement {
  const [c, g] = makeCanvas(72);
  if (!g) return c;
  const grad = g.createRadialGradient(28, 25, 3, 36, 36, 30);
  grad.addColorStop(0, css(toward(color, WHITE, 0.55)));
  grad.addColorStop(0.55, css(color));
  grad.addColorStop(1, css(toward(color, BLACK, 0.2)));
  g.shadowColor = "rgba(0, 0, 0, 0.2)";
  g.shadowBlur = 5;
  g.shadowOffsetY = 2;
  g.fillStyle = grad;
  g.beginPath();
  g.arc(36, 34, 27, 0, Math.PI * 2);
  g.fill();
  g.shadowColor = "transparent";
  // 毛羽
  for (let i = 0; i < 70; i++) {
    const a = Math.random() * Math.PI * 2, r = 22 + Math.random() * 7;
    g.fillStyle = css(toward(color, Math.random() < 0.5 ? WHITE : BLACK, 0.18), 0.55);
    g.beginPath();
    g.arc(36 + Math.cos(a) * r, 34 + Math.sin(a) * r, 1.3 + Math.random() * 1.2, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

/** フェルトの星: 縁に縫い目のある、切り抜いた星。 */
function starSprite(color: [number, number, number]): HTMLCanvasElement {
  const [c, g] = makeCanvas(72);
  if (!g) return c;
  const path = (R: number, r: number) => {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? R : r, a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
      g.lineTo(36 + Math.cos(a) * rad, 37 + Math.sin(a) * rad);
    }
    g.closePath();
  };
  const grad = g.createLinearGradient(0, 8, 0, 66);
  grad.addColorStop(0, css(toward(color, WHITE, 0.28)));
  grad.addColorStop(1, css(toward(color, BLACK, 0.1)));
  g.lineJoin = "round";
  g.shadowColor = "rgba(0, 0, 0, 0.22)";
  g.shadowBlur = 5;
  g.shadowOffsetY = 2;
  g.fillStyle = grad;
  g.strokeStyle = css(toward(color, BLACK, 0.04));
  g.lineWidth = 7;
  path(25, 12.5);
  g.stroke();
  g.fill();
  g.shadowColor = "transparent";
  g.setLineDash([3.2, 3.2]);
  g.lineWidth = 1.4;
  g.strokeStyle = css(toward(color, WHITE, 0.75), 0.95);
  path(19, 9.5);
  g.stroke();
  return c;
}

/** 紙: 折り目で明るさが変わる、角の丸い紙片。 */
function paperSprite(color: [number, number, number]): HTMLCanvasElement {
  const [c, g] = makeCanvas(72);
  if (!g) return c;
  const grad = g.createLinearGradient(8, 0, 64, 0);
  grad.addColorStop(0, css(toward(color, WHITE, 0.3)));
  grad.addColorStop(0.5, css(color));
  grad.addColorStop(0.52, css(toward(color, BLACK, 0.12)));
  grad.addColorStop(1, css(toward(color, WHITE, 0.08)));
  g.fillStyle = grad;
  g.shadowColor = "rgba(0, 0, 0, 0.16)";
  g.shadowBlur = 4;
  g.shadowOffsetY = 1.5;
  g.beginPath();
  g.roundRect(9, 19, 54, 32, 7);
  g.fill();
  return c;
}

/** きらめき: にじむ光をまとった四つ角の星。 */
function sparkSprite(): HTMLCanvasElement {
  const [c, g] = makeCanvas(96);
  if (!g) return c;
  const glow = g.createRadialGradient(48, 48, 0, 48, 48, 46);
  glow.addColorStop(0, "rgba(255, 255, 255, 0.55)");
  glow.addColorStop(0.4, "rgba(255, 255, 255, 0.14)");
  glow.addColorStop(1, "rgba(255, 255, 255, 0)");
  g.fillStyle = glow;
  g.fillRect(0, 0, 96, 96);
  g.fillStyle = "#FFFFFF";
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 === 0 ? 34 : 7, a = (i / 8) * Math.PI * 2;
    g.lineTo(48 + Math.cos(a) * r, 48 + Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  return c;
}

/** やわらかい光の粒 (ほこり・ぼけ)。 */
function glowSprite(): HTMLCanvasElement {
  const [c, g] = makeCanvas(64);
  if (!g) return c;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
  grad.addColorStop(0.35, "rgba(255, 255, 255, 0.4)");
  grad.addColorStop(1, "rgba(255, 255, 255, 0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return c;
}

class Confetti {
  private ctx: CanvasRenderingContext2D | null;
  private pieces: Piece[] = [];
  private raf = 0;
  private last = 0;
  private w = 0;
  private h = 0;
  private felt: HTMLCanvasElement[];
  private paper: HTMLCanvasElement[];
  private glow: HTMLCanvasElement;
  private spark: HTMLCanvasElement;

  constructor(private canvas: HTMLCanvasElement, hero: [number, number, number]) {
    this.ctx = canvas.getContext("2d");
    // 色はタイプの色の濃淡 + 白・クリーム・金でそろえる (ばらばらの原色にしない)
    const gold: [number, number, number] = [247, 200, 82];
    const cream: [number, number, number] = [255, 244, 220];
    const light = toward(hero, WHITE, 0.55), deep = toward(hero, BLACK, 0.24);
    const blush: [number, number, number] = [255, 190, 205];
    this.felt = [pomSprite(WHITE), pomSprite(gold), pomSprite(light), pomSprite(deep), starSprite(gold), starSprite(cream), starSprite(gold), starSprite(blush)];
    this.paper = [paperSprite(WHITE), paperSprite(cream), paperSprite(gold), paperSprite(light), paperSprite(deep), paperSprite(blush)];
    this.glow = glowSprite();
    this.spark = sparkSprite();
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private add(kind: "felt" | "paper", x: number, y: number, vx: number, vy: number, born: number) {
    // 奥 (小さく淡い)・中・手前 (大きい) の3段
    const roll = Math.random();
    const depth = roll < 0.4 ? 0.62 : roll < 0.86 ? 1 : 1.7;
    const set = kind === "felt" ? this.felt : this.paper;
    this.pieces.push({
      kind, sprite: set[(Math.random() * set.length) | 0],
      x, y, vx: vx * (0.8 + depth * 0.2), vy: vy * (0.8 + depth * 0.2), depth,
      size: (kind === "felt" ? 15 + Math.random() * 8 : 14 + Math.random() * 9) * depth,
      rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * (kind === "felt" ? 5 : 9),
      flip: Math.random() * Math.PI * 2, vflip: 4 + Math.random() * 7,
      sway: Math.random() * Math.PI * 2, swayAmp: 24 + Math.random() * 52, born, life: 0,
    });
  }

  private order() {
    this.pieces.sort((a, b) => a.depth - b.depth);
    this.start();
  }

  /** (x, y) から、angle (ラジアン。上向きは -π/2) を中心に spread の幅で打ち上げる。 */
  burst(x: number, y: number, count: number, angle: number, spread: number, speed: [number, number]) {
    const now = performance.now();
    for (let i = 0; i < count; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const v = speed[0] + Math.random() * (speed[1] - speed[0]);
      this.add(Math.random() < 0.36 ? "felt" : "paper", x, y, Math.cos(a) * v, Math.sin(a) * v, now);
    }
    this.order();
  }

  /** 画面の上から、count 個が overMs のあいだにぱらぱら降る。 */
  rain(count: number, overMs: number) {
    const now = performance.now();
    for (let i = 0; i < count; i++) {
      this.add(Math.random() < 0.3 ? "felt" : "paper", Math.random() * this.w, -30, (Math.random() - 0.5) * 80, 60 + Math.random() * 160, now + Math.random() * overMs);
    }
    this.order();
  }

  /** (x, y) のまわり radius の範囲に、きらめきを count 個。 */
  sparkle(x: number, y: number, radius: number, count: number, overMs = 900) {
    const now = performance.now();
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, r = radius * (0.5 + Math.random() * 0.55);
      this.pieces.push({
        kind: "spark", sprite: this.spark, x: x + Math.cos(a) * r, y: y + Math.sin(a) * r * 0.8, vx: 0, vy: 0, depth: 2,
        size: 8 + Math.random() * 12, rot: 0, vr: 0, flip: 0, vflip: 0, sway: 0, swayAmp: 0,
        born: now + Math.random() * overMs, life: 640 + Math.random() * 480,
      });
    }
    this.order();
  }

  /** (x, y) を中心とした範囲を、光の粒がゆっくり漂う (スポットライトの中のほこり、舞台のぼけ)。 */
  dust(x: number, y: number, rx: number, ry: number, count: number, size: [number, number], overMs: number) {
    const now = performance.now();
    for (let i = 0; i < count; i++) {
      this.pieces.push({
        kind: "dust", sprite: this.glow, x: x + (Math.random() - 0.5) * 2 * rx, y: y + (Math.random() - 0.5) * 2 * ry,
        vx: (Math.random() - 0.5) * 14, vy: -8 - Math.random() * 16, depth: 0.1,
        size: size[0] + Math.random() * (size[1] - size[0]), rot: 0, vr: 0, flip: 0, vflip: 0, sway: 0, swayAmp: 0,
        born: now + Math.random() * overMs, life: 1700 + Math.random() * 1500,
      });
    }
    this.order();
  }

  /** いま漂っている光の粒を、すっと消す。 */
  clearDust() {
    const now = performance.now();
    for (const p of this.pieces) if (p.kind === "dust") p.life = Math.min(p.life, Math.max(0, now - p.born) + 260);
  }

  private start() {
    if (this.raf) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.pieces = [];
  }

  private frame = (now: number) => {
    const ctx = this.ctx;
    if (!ctx) return;
    const dt = Math.min(0.034, (now - this.last) / 1000);
    this.last = now;
    ctx.clearRect(0, 0, this.w, this.h);


    const next: Piece[] = [];
    for (const p of this.pieces) {
      const age = now - p.born;
      if (age < 0) { next.push(p); continue; }
      if (p.kind === "spark") {
        if (age > p.life) continue;
        const k = Math.sin((age / p.life) * Math.PI), d = p.size * k * 2.8;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((age / p.life) * 0.9);
        ctx.globalAlpha = Math.min(1, k * 1.4);
        if (p.sprite) ctx.drawImage(p.sprite, -d / 2, -d / 2, d, d);
        ctx.restore();
        next.push(p);
        continue;
      }
      if (p.kind === "dust") {
        if (age > p.life) continue;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        ctx.globalAlpha = Math.sin((age / p.life) * Math.PI) * 0.55;
        if (p.sprite) ctx.drawImage(p.sprite, p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        ctx.globalAlpha = 1;
        next.push(p);
        continue;
      }
      // 空気の抵抗で勢いが落ち、紙はひらひら、フェルトはすとんと落ちる
      const felt = p.kind === "felt";
      const drag = Math.exp(-(felt ? 1.15 : 1.9) * dt);
      p.vx *= drag;
      p.vy = Math.min(p.vy * drag + 1500 * dt, (felt ? 820 : 340) * (0.75 + p.depth * 0.25));
      p.sway += dt * 3.1;
      p.x += (p.vx + (felt ? 0 : Math.sin(p.sway) * p.swayAmp)) * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.flip += p.vflip * dt;
      if (p.y > this.h + 60 || p.x < -80 || p.x > this.w + 80) continue;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (!felt) ctx.scale(1, Math.cos(p.flip));
      ctx.globalAlpha = p.depth < 1 ? 0.78 : 1;
      if (p.sprite) ctx.drawImage(p.sprite, -p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
      next.push(p);
    }
    this.pieces = next;
    this.raf = next.length > 0 ? requestAnimationFrame(this.frame) : 0;
  };
}

export function ResultRevealStage({
  target,
  onCovered,
  onDone,
}: {
  target: ResultRevealTarget;
  /** 明かりが落ちきった (裏の解析待ち画面を片づけてよい)。 */
  onCovered: () => void;
  /** すべて終わった (この演出を片づけてよい)。 */
  onDone: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const darkRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const brightRef = useRef<HTMLDivElement>(null);
  const raysRef = useRef<HTMLDivElement>(null);
  const beamRef = useRef<HTMLDivElement>(null);
  const poolRef = useRef<HTMLDivElement>(null);
  const groundRef = useRef<HTMLDivElement>(null);
  const charRef = useRef<HTMLDivElement>(null);
  const charInnerRef = useRef<HTMLImageElement>(null);
  const shineRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLDivElement>(null);
  const leadRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const callbacks = useRef({ onCovered, onDone });
  useEffect(() => {
    callbacks.current = { onCovered, onDone };
  });

  const letters = Array.from(target.name);
  const hero = rgbOf(target.heroColor);
  const deep = css(toward(hero, [20, 16, 46], 0.8)); // 明かりを落とした舞台の色
  const groundRgb = toward(hero, BLACK, 0.62); // 足元の影の色 (舞台の色をそのまま暗くした色)

  useEffect(() => {
    const root = rootRef.current, dark = darkRef.current, world = worldRef.current, bright = brightRef.current;
    const rays = raysRef.current, beam = beamRef.current, pool = poolRef.current, ground = groundRef.current;
    const char = charRef.current, charInner = charInnerRef.current, shine = shineRef.current;
    const nameEl = nameRef.current, lead = leadRef.current;
    const flash = flashRef.current, canvas = canvasRef.current;
    if (!root || !dark || !world || !bright || !rays || !beam || !pool || !ground || !char || !charInner || !shine || !nameEl || !lead || !flash || !canvas) return;

    let cancelled = false;
    let phase: "intro" | "pop" | "hold" | "settle" = "intro";
    let fast = false; // じらしを飛ばす
    let wake: (() => void) | null = null;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const anims: Animation[] = [];
    const play = (el: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions) => {
      const a = el.animate(keyframes, { fill: "both", ...options });
      anims.push(a);
      return a;
    };
    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        if (fast || ms <= 0) { resolve(); return; }
        const done = () => { timers.delete(id); wake = null; resolve(); };
        const id = setTimeout(done, ms);
        timers.add(id);
        wake = () => { clearTimeout(id); done(); };
      });
    const later = (ms: number, fn: () => void) => {
      const id = setTimeout(() => { timers.delete(id); if (!cancelled) fn(); }, ms);
      timers.add(id);
    };

    // ---- 配置: 名前と絵を、画面の中央に「名前の下に絵」の形で少し大きく置く ----
    //   スマホ (もともと縦に並ぶ) は、結果ページの並びをそのまま少し大きくして中央へ。
    //   PC (名前が左・絵が右) は、発表のあいだだけ中央に縦に並べ、着地でそれぞれの位置へ分かれる。
    const vw = window.innerWidth, vh = window.innerHeight;
    const n = target.nameBox, im = target.imageBox;
    const letterEls = Array.from(nameEl.querySelectorAll<HTMLElement>("[data-letter]"));
    nameEl.style.transform = "";
    // 名前の文字そのものの幅と位置 (左寄せの画面では、枠の幅と文字の幅が違う)
    const firstBox = letterEls[0].getBoundingClientRect();
    const lastBox = letterEls[letterEls.length - 1].getBoundingClientRect();
    const textLeft = firstBox.left - n.left;
    const textWidth = Math.max(1, lastBox.right - firstBox.left);
    for (const el of Array.from(nameEl.querySelectorAll<HTMLElement>("[data-side]"))) {
      el.style.left = `${textLeft}px`;
      el.style.width = `${textWidth}px`;
    }
    const nameFontPx = parseFloat(target.nameStyle.fontSize) || 48;
    const nameCx = n.left + n.width / 2, nameCy = n.top + n.height / 2;
    const imCx = im.left + im.width / 2, imCy = im.top + im.height / 2;
    const textCx = n.left + textLeft + textWidth / 2;
    const stacked = im.top >= n.top && im.left < n.left + n.width && im.left + im.width > n.left;
    let nameScale: number, charScale: number;
    let nameAt: { x: number; y: number }, charAt: { x: number; y: number };
    if (stacked) {
      const blockLeft = Math.min(n.left, im.left), blockRight = Math.max(n.left + n.width, im.left + im.width);
      const blockTop = n.top - 40, blockBottom = im.top + im.height;
      const bw = blockRight - blockLeft, bh = blockBottom - blockTop;
      const bx = (blockLeft + blockRight) / 2, by = (blockTop + blockBottom) / 2;
      charScale = Math.max(0.8, Math.min(1.18, (1.1 * vw) / bw, (0.9 * vh) / bh));
      nameScale = Math.min(charScale, (0.9 * vw) / textWidth);
      nameAt = { x: vw / 2 + (textCx - bx) * charScale, y: vh / 2 + (nameCy - by) * charScale - 8 };
      charAt = { x: vw / 2 + (imCx - bx) * charScale, y: vh / 2 + (imCy - by) * charScale + 8 };
    } else {
      charScale = Math.max(0.6, Math.min(1.15, (0.56 * vh) / im.height, (0.9 * vw) / im.width));
      nameScale = Math.min(1.3, (0.9 * vw) / textWidth);
      const above = nameFontPx * nameScale * 0.7; // 「あなたは」のぶん
      const below = nameFontPx * nameScale * 0.25; // 名前と絵のあいだ
      const nameH = n.height * nameScale, charH = im.height * charScale;
      const overlap = charH * 0.05; // 絵の上の透明な余白のぶんだけ詰める
      const top = Math.max(12, (vh - (above + nameH + below + charH - overlap)) / 2);
      nameAt = { x: vw / 2, y: top + above + nameH / 2 };
      charAt = { x: vw / 2, y: top + above + nameH + below - overlap + charH / 2 };
    }
    // 枠の中心を基準に拡大するので、文字の中心が狙った位置に来るように横をずらす
    const textOff = textLeft + textWidth / 2 - n.width / 2;
    const nameStage = `translate(${nameAt.x - nameCx - textOff * nameScale}px, ${nameAt.y - nameCy}px) scale(${nameScale})`;
    const charStage = `translate(${charAt.x - imCx}px, ${charAt.y - imCy}px) scale(${charScale})`;
    nameEl.style.transform = nameStage;
    char.style.transform = charStage;

    // 光・影は、舞台上のキャラクターの位置に合わせる
    const charW = im.width * charScale, charH = im.height * charScale;
    const feet = charAt.y + charH * 0.4; // 足元あたり
    world.style.transformOrigin = `${charAt.x}px ${charAt.y}px`;
    rays.style.left = `${charAt.x}px`;
    rays.style.top = `${charAt.y}px`;
    const beamH = feet + vh * 0.1;
    const beamW = Math.max(charW * 1.5, beamH * 0.64); // 円すいの開き (±17度) が収まる幅
    Object.assign(beam.style, { left: `${charAt.x - beamW / 2}px`, top: `${-vh * 0.1}px`, width: `${beamW}px`, height: `${beamH}px` });
    Object.assign(pool.style, { left: `${charAt.x - charW * 0.62}px`, top: `${feet - charH * 0.13}px`, width: `${charW * 1.24}px`, height: `${charH * 0.26}px` });
    // 足元の影は、絵が実際に地面に触れている場所へ。絵の後ろに敷き、下の縁からやわらかくのぞかせる。
    const foot = target.foot ?? { cx: 0.5, bottom: 0.92, width: 0.6 };
    const footX = charAt.x + (foot.cx - 0.5) * charW;
    const footY = charAt.y + (foot.bottom - 0.5) * charH;
    const groundW = Math.min(charW * 1.3, Math.max(charW * 0.4, foot.width * charW * GROUND_SPREAD));
    const groundH = Math.min(charH * 0.16, groundW * GROUND_FLAT);
    Object.assign(ground.style, { left: `${footX - groundW / 2}px`, top: `${footY - groundH * GROUND_LIFT}px`, width: `${groundW}px`, height: `${groundH}px` });
    flash.style.background = `radial-gradient(circle at ${charAt.x}px ${charAt.y}px, #fff 0%, rgba(255,255,255,0.95) 30%, rgba(255,255,255,0.82) 100%)`;

    const dotEls = Array.from(lead.querySelectorAll<HTMLElement>("[data-dot]"));
    // 「...」の幅。発表で点が消えたあと、残る「あなたは」を名前の真上に置き直すのに使う。
    const dotsEl = lead.querySelector<HTMLElement>("[data-dots]");
    const dotsWidth = dotsEl?.offsetWidth ?? 0;
    const confetti = new Confetti(canvas, rgbOf(target.heroColor));
    const onResize = () => confetti.resize();
    window.addEventListener("resize", onResize);

    document.documentElement.setAttribute("data-result-reveal", "on");
    charInner.style.filter = "brightness(0)"; // はじめは影

    // 演出のあいだは、裏の結果ページを動かさない
    const block = (e: Event) => e.preventDefault();
    root.addEventListener("wheel", block, { passive: false });
    root.addEventListener("touchmove", block, { passive: false });
    const startedAt = performance.now();
    const onTap = () => {
      // 明かりが落ちきる前は受け付けない (暗くなりきる前に発表が始まらないように)
      if (phase === "intro" && performance.now() - startedAt > DARK_MS + 160) { fast = true; wake?.(); }
      else if (phase === "hold") wake?.();
    };
    root.addEventListener("pointerdown", onTap);

    const run = async () => {
      // ===== 1. じらす: 明かりが落ち、スポットライトの中に影が浮かぶ =====
      play(dark, [{ opacity: 0 }, { opacity: 1 }], { duration: DARK_MS, easing: "cubic-bezier(0.4, 0, 0.2, 1)" });
      later(DARK_MS, () => callbacks.current.onCovered());
      // カメラがゆっくり寄っていく
      const pushIn = play(world, [{ transform: "scale(1)" }, { transform: "scale(1.06)" }], { duration: REVEAL_AT, easing: "cubic-bezier(0.3, 0, 0.7, 1)" });

      await sleep(SPOT_AT);
      if (cancelled) return;
      // スポットライトが、ちらついてから点く
      const spotOn: Keyframe[] = [{ opacity: 0 }, { opacity: 0.85, offset: 0.25 }, { opacity: 0.35, offset: 0.42 }, { opacity: 1, offset: 0.7 }, { opacity: 1 }];
      play(beam, spotOn, { duration: 520, easing: "ease-out" });
      play(pool, spotOn, { duration: 520, easing: "ease-out" });
      confetti.dust(charAt.x, charAt.y - charH * 0.15, charW * 0.42, charH * 0.5, 16, [5, 13], 1500);

      await sleep(SHADOW_AT - SPOT_AT);
      if (cancelled) return;
      play(charInner, [
        { opacity: 0, transform: "translateY(4%) scale(0.86)" },
        { opacity: 0.82, transform: "none" },
      ], { duration: 560, easing: "cubic-bezier(0.2, 0.9, 0.3, 1)" });

      await sleep(LEAD_AT - SHADOW_AT);
      if (cancelled) return;
      play(lead, [
        { opacity: 0, letterSpacing: "0.5em" },
        { opacity: 1, letterSpacing: "0.2em" },
      ], { duration: 700, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" });
      // 影がそわそわ揺れ、スポットライトが脈を打つ。発表に向けて少しずつ速くなる。
      const wobble = play(charInner, [
        { rotate: "0deg", scale: "1" },
        { rotate: "-1.6deg", scale: "1.02", offset: 0.25 },
        { rotate: "0deg", scale: "0.992", offset: 0.5 },
        { rotate: "1.6deg", scale: "1.02", offset: 0.75 },
        { rotate: "0deg", scale: "1" },
      ], { duration: 760, iterations: Infinity, delay: 200, easing: "ease-in-out" });
      const throb = play(pool, [{ scale: "1" }, { scale: "1.1" }, { scale: "1" }], { duration: 760, iterations: Infinity, delay: 200, easing: "ease-in-out" });
      const quicken = (rate: number) => { wobble.updatePlaybackRate(rate); throb.updatePlaybackRate(rate); };

      let clock = LEAD_AT;
      for (const [i, at] of DOT_AT.entries()) {
        await sleep(at - clock);
        clock = at;
        if (cancelled) return;
        play(dotEls[i], [
          { opacity: 0, transform: "translateY(6px) scale(0.4)" },
          { opacity: 1, transform: "translateY(-3px) scale(1.25)", offset: 0.6 },
          { opacity: 1, transform: "none" },
        ], { duration: 300, easing: "ease-out" });
        quicken(1.3 + i * 0.5);
      }
      await sleep(REVEAL_AT - 520 - clock);
      if (cancelled) return;
      quicken(3.4);
      await sleep(340);
      if (cancelled) return;
      // 跳ぶ前に、ぐっと沈む
      wobble.cancel();
      play(charInner, [
        { opacity: 0.82, transform: "none" },
        { opacity: 0.82, transform: "translateY(3%) scale(1.06, 0.9)" },
      ], { duration: 180, easing: "cubic-bezier(0.3, 0, 0.6, 1)" });
      await sleep(180);
      if (cancelled) return;

      // ===== 2. 発表 =====
      phase = "pop";
      fast = false;
      play(flash, [{ opacity: 0 }, { opacity: 1, offset: 0.18 }, { opacity: 0 }], { duration: 640, easing: "ease-out" });
      await sleep(110); // 光がいちばん強いときに、影を本物へ、暗い舞台をタイプの色へ入れ替える
      if (cancelled) return;
      throb.cancel();
      pushIn.cancel();
      confetti.clearDust();
      charInner.style.filter = "none";
      play(dark, [{ opacity: 1 }, { opacity: 0 }], { duration: 1 });
      play(bright, [{ opacity: 0 }, { opacity: 1 }], { duration: 1 });
      play(beam, [{ opacity: 1 }, { opacity: 0 }], { duration: 1 });
      play(pool, [{ opacity: 1 }, { opacity: 0 }], { duration: 1 });
      // カメラが一瞬ぐっと寄って、戻る
      play(world, [
        { transform: "scale(1.14)" },
        { transform: "scale(0.985)", offset: 0.5 },
        { transform: "scale(1.006)", offset: 0.78 },
        { transform: "scale(1)" },
      ], { duration: 760, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)" });
      play(charInner, [
        { opacity: 1, transform: "translateY(3%) scale(1.06, 0.9)" },
        { opacity: 1, transform: "translateY(-7%) scale(0.96, 1.1)", offset: 0.3 },
        { opacity: 1, transform: "translateY(0) scale(1.07, 0.94)", offset: 0.56 },
        { opacity: 1, transform: "translateY(-1.5%) scale(0.99, 1.02)", offset: 0.78 },
        { opacity: 1, transform: "none" },
      ], { duration: 820, easing: "ease-out" });
      play(ground, [
        { opacity: 0, transform: "scale(0.7)" },
        { opacity: 0.55, transform: "scale(0.7)", offset: 0.3 },
        { opacity: 1, transform: "scale(1.08)", offset: 0.56 },
        { opacity: 1, transform: "scale(1)" },
      ], { duration: 820, easing: "ease-out" });
      play(rays, [{ opacity: 0, scale: "0.6" }, { opacity: 1, scale: "2" }], { duration: 760, easing: "cubic-bezier(0.2, 0.9, 0.3, 1)" });
      const spin = play(rays, [{ rotate: "0deg" }, { rotate: "360deg" }], { duration: 38000, iterations: Infinity, easing: "linear" });
      play(dotsEl ?? lead, [{ opacity: 1 }, { opacity: 0 }], { duration: 200 });
      // 点は消えても幅が残るので、そのままだと「あなたは」が点の半分だけ左に寄って見える。
      // 光っているあいだに、そのぶん右へ送って名前の真上にそろえる。
      play(lead, [{ translate: "0 0" }, { translate: `${dotsWidth / 2}px 0` }], { duration: 200, easing: "ease-out" });
      for (const [i, el] of letterEls.entries()) {
        play(el, [
          { opacity: 0, transform: "translateY(0.6em) scale(0.2) rotate(-14deg)" },
          { opacity: 1, transform: "translateY(-0.16em) scale(1.26) rotate(4deg)", offset: 0.5 },
          { opacity: 1, transform: "translateY(0.035em) scale(0.94) rotate(-1.2deg)", offset: 0.76 },
          { opacity: 1, transform: "none" },
        ], { duration: 680, delay: 90 + i * 78, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)" });
      }
      const nameDone = 90 + letterEls.length * 78 + 320;
      // キャラクターの上を、光がひとすじ走る
      play(shine, [{ opacity: 1, backgroundPosition: "135% 0" }, { opacity: 1, backgroundPosition: "-35% 0" }], { duration: 900, delay: 620, easing: "cubic-bezier(0.4, 0, 0.3, 1)" });
      later(1560, () => { shine.style.display = "none"; });

      const up = -Math.PI / 2;
      confetti.burst(charAt.x, charAt.y - charH * 0.05, 96, up, Math.PI * 1.5, [560, 1300]);
      confetti.sparkle(charAt.x, charAt.y, Math.max(charW, charH) * 0.5, 12);
      confetti.dust(vw / 2, vh * 0.5, vw * 0.55, vh * 0.5, 9, [36, 96], 2600);
      later(240, () => {
        confetti.burst(-10, vh * 0.88, 44, up + 0.6, 0.7, [950, 1550]);
        confetti.burst(vw + 10, vh * 0.88, 44, up - 0.6, 0.7, [950, 1550]);
      });
      // 打ち上げた分が落ちきるころ、上からぱらぱら降らせる (着地したあとも結果ページの上に少し降る)
      later(1000, () => confetti.rain(58, 2900));
      later(nameDone + 160, () => confetti.sparkle(nameAt.x, nameAt.y, Math.max(textWidth, 120) * nameScale * 0.62, 9));

      await sleep(860);
      if (cancelled) return;
      // 少し浮いて、息をしているように
      const float = play(char, [{ translate: "0 0" }, { translate: "0 -7px" }, { translate: "0 0" }], { duration: 2100, iterations: Infinity, easing: "ease-in-out" });
      // 影の伸び縮みは止めない (着地で影ごと消える。途中で止めると大きさが一瞬で変わる)。
      play(ground, [{ scale: "1" }, { scale: "0.93" }, { scale: "1" }], { duration: 2100, iterations: Infinity, easing: "ease-in-out" });

      // ===== 3. 見せる → 着地 =====
      phase = "hold";
      await sleep(HOLD_MS - 860);
      if (cancelled) return;
      phase = "settle";
      // 浮いている途中で止めると、その高さ (最大7px) から一瞬で元の高さへ落ち、動き出しがカクッと見える。
      // いま浮いている高さを読み、そこから着地の動きへつなぐ。
      const lift = getComputedStyle(char).translate;
      float.cancel();
      const ease = "cubic-bezier(0.6, 0, 0.2, 1)";
      // 着地先は、いまの結果ページの実物を測り直して決める。はじめに測った位置のままだと、演出のあいだに
      // 結果ページが動いたとき (書体があとから届く、上に何かが足される、端末が画面の基準をずらす) に、
      // 着地した絵と本体の絵が重ならず、入れ替わりでカクッと動いて見える。
      // 演出側の枠も同じ測り方で読むので、どちらがずれていても差だけを埋められる。
      const stageBox = root.getBoundingClientRect();
      const landOn = (selector: string, from: Box, resize: boolean) => {
        const real = document.querySelector<HTMLElement>(`[data-result-hero] ${selector}`)?.getBoundingClientRect();
        if (!real || real.width < 1 || from.width < 1) return "none";
        const dx = real.left + real.width / 2 - (stageBox.left + from.left + from.width / 2);
        const dy = real.top + real.height / 2 - (stageBox.top + from.top + from.height / 2);
        const k = resize ? real.width / from.width : 1;
        if (Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05 && Math.abs(k - 1) < 0.0005) return "none";
        return `translate(${dx}px, ${dy}px) scale(${k})`;
      };
      play(nameEl, [{ transform: nameStage }, { transform: landOn("[data-result-hero-name]", n, false) }], { duration: SETTLE_MS, easing: ease });
      const landing = play(char, [
        { transform: charStage, translate: lift && lift !== "none" ? lift : "0 0" },
        { transform: landOn("[data-result-hero-image] img", im, true), translate: "0 0" },
      ], { duration: SETTLE_MS, easing: ease });
      play(lead, [{ opacity: 1 }, { opacity: 0 }], { duration: 240 });
      play(ground, [{ opacity: 1 }, { opacity: 0 }], { duration: 300 });
      play(rays, [{ opacity: 1 }, { opacity: 0 }], { duration: 520 });
      play(bright, [{ opacity: 1 }, { opacity: 0 }], { duration: 580, delay: 230, easing: "ease-out" });

      // 着地の動きが終わりきってから入れ替える。時間だけで待つと、動き出しが遅れた端末では、絵がまだ
      // 動いている途中で本体が出て二重に見える。(終わりの知らせが来ない場合に備えて、時間の上限も置く)
      await Promise.race([
        landing.finished.then(() => undefined, () => undefined),
        new Promise<void>((resolve) => later(SETTLE_MS + 400, resolve)),
      ]);
      if (cancelled) return;
      // 着地した。結果ページ本体の名前と絵を出し、上に重なっている演出側を消す。
      spin.cancel();
      document.documentElement.removeAttribute("data-result-reveal");
      root.style.pointerEvents = "none";
      root.removeEventListener("wheel", block);
      root.removeEventListener("touchmove", block);
      play(nameEl, [{ opacity: 1 }, { opacity: 0 }], { duration: 200 });
      play(char, [{ opacity: 1 }, { opacity: 0 }], { duration: 200 });
      // 残った紙吹雪は、結果ページの上に落ちきってから消える
      play(canvas, [{ opacity: 1 }, { opacity: 0 }], { duration: 1000, delay: 900, easing: "ease-in" });
      await new Promise<void>((resolve) => later(1950, resolve));
      if (cancelled) return;
      callbacks.current.onDone();
    };
    void run();

    return () => {
      cancelled = true;
      for (const id of timers) clearTimeout(id);
      for (const a of anims) a.cancel();
      confetti.stop();
      window.removeEventListener("resize", onResize);
      root.removeEventListener("wheel", block);
      root.removeEventListener("touchmove", block);
      root.removeEventListener("pointerdown", onTap);
      document.documentElement.removeAttribute("data-result-reveal");
      // 開発時の再実行に備えて、手で付けた見た目を戻す
      charInner.style.filter = "";
      shine.style.display = "";
      root.style.pointerEvents = "";
    };
  }, [target]);

  const { nameBox, imageBox, nameStyle } = target;
  const nameFont = parseFloat(nameStyle.fontSize) || 48;
  const maskUrl = `url("${target.imageSrc.replace(/"/g, "%22")}")`;

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[80] select-none overflow-hidden"
      style={{ touchAction: "none", overscrollBehavior: "contain" }}
    >
      <span className="sr-only" role="status">{`あなたの性格タイプは${target.name}です`}</span>
      {/* 明かりを落とした舞台 */}
      <div ref={darkRef} aria-hidden="true" className="absolute inset-0" style={{ opacity: 0, backgroundColor: deep }}>
        <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(ellipse at 50% 46%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.42) 100%)" }} />
        <div className="absolute inset-0" style={{ backgroundImage: GRAIN, opacity: 0.05 }} />
      </div>
      <div ref={worldRef} className="absolute inset-0">
        {/* 発表したあとの舞台: タイプの色。中央が明るく、四隅が少し沈む。 */}
        <div ref={brightRef} aria-hidden="true" className="absolute" style={{ inset: "-8%", opacity: 0, backgroundColor: target.heroColor }}>
          <div
            className="absolute inset-0"
            style={{ backgroundImage: `radial-gradient(ellipse at 50% 48%, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0) 58%), radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 52%, ${css(toward(hero, BLACK, 0.4), 0.16)} 100%)` }}
          />
          <div className="absolute inset-0" style={{ backgroundImage: GRAIN, opacity: 0.07 }} />
        </div>
        {/* 後ろから差す光。小さく描いて大きく引き伸ばすことで、縁のやわらかい光にする。 */}
        <div
          ref={raysRef}
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{
            width: "96vmax",
            height: "96vmax",
            marginLeft: "-48vmax",
            marginTop: "-48vmax",
            opacity: 0,
            willChange: "transform",
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 30%), conic-gradient(from 0deg, rgba(255,255,255,0) 0deg, rgba(255,255,255,0.34) 9deg, rgba(255,255,255,0) 21deg, rgba(255,255,255,0) 38deg, rgba(255,255,255,0.16) 47deg, rgba(255,255,255,0) 58deg, rgba(255,255,255,0) 83deg, rgba(255,255,255,0.32) 95deg, rgba(255,255,255,0) 110deg, rgba(255,255,255,0) 128deg, rgba(255,255,255,0.14) 136deg, rgba(255,255,255,0) 146deg, rgba(255,255,255,0) 170deg, rgba(255,255,255,0.34) 183deg, rgba(255,255,255,0) 197deg, rgba(255,255,255,0) 221deg, rgba(255,255,255,0.15) 229deg, rgba(255,255,255,0) 239deg, rgba(255,255,255,0) 262deg, rgba(255,255,255,0.32) 274deg, rgba(255,255,255,0) 288deg, rgba(255,255,255,0) 309deg, rgba(255,255,255,0.16) 318deg, rgba(255,255,255,0) 329deg, rgba(255,255,255,0) 360deg)",
            WebkitMaskImage: "radial-gradient(circle, #000 0%, #000 18%, transparent 50%)",
            maskImage: "radial-gradient(circle, #000 0%, #000 18%, transparent 50%)",
          }}
        />
        {/* スポットライト: 上から差す光の柱と、足元の光だまり */}
        <div
          ref={beamRef}
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{
            opacity: 0,
            backgroundImage:
              "conic-gradient(from 163deg at 50% 0%, rgba(255,255,255,0) 0deg, rgba(255,255,255,0.14) 6deg, rgba(255,255,255,0.34) 12deg, rgba(255,255,255,0.34) 22deg, rgba(255,255,255,0.14) 28deg, rgba(255,255,255,0) 34deg, rgba(255,255,255,0) 360deg)",
            WebkitMaskImage: "linear-gradient(to bottom, #000 0%, #000 55%, rgba(0,0,0,0.25) 88%, transparent 100%)",
            maskImage: "linear-gradient(to bottom, #000 0%, #000 55%, rgba(0,0,0,0.25) 88%, transparent 100%)",
          }}
        />
        <div
          ref={poolRef}
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{ opacity: 0, backgroundImage: "radial-gradient(ellipse at center, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.16) 45%, rgba(255,255,255,0) 70%)" }}
        />
        {/* 足元の影 (発表のあいだだけ。キャラクターに重さを出す) */}
        <div
          ref={groundRef}
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{
            opacity: 0,
            // 芯は濃く、外へ向かってなだらかに消える (縁の見える楕円にしない)
            backgroundImage: `radial-gradient(ellipse at center, ${css(groundRgb, 0.4)} 0%, ${css(groundRgb, 0.27)} 28%, ${css(groundRgb, 0.11)} 52%, ${css(groundRgb, 0.03)} 66%, ${css(groundRgb, 0)} 74%)`,
          }}
        />
        {/* キャラクター。はじめは影、発表で本物になる。置き場所は結果ページの実物と同じ。 */}
        <div
          ref={charRef}
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{ left: imageBox.left, top: imageBox.top, width: imageBox.width, height: imageBox.height }}
        >
          {/* 結果ページが読み込み済みの画像をそのまま使う (next/image を通すと別の画像を取りに行ってしまう) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={charInnerRef}
            src={target.imageSrc}
            alt=""
            decoding="sync"
            draggable={false}
            className="h-full w-full"
            style={{ objectFit: target.imageFit as "contain", opacity: 0, transformOrigin: "50% 88%" }}
          />
          {/* キャラクターの形に切り抜いた、走る光 */}
          <div
            ref={shineRef}
            className="absolute inset-0"
            style={{
              opacity: 0,
              backgroundImage: "linear-gradient(112deg, rgba(255,255,255,0) 40%, rgba(255,255,255,0.78) 50%, rgba(255,255,255,0) 60%)",
              backgroundSize: "300% 100%",
              backgroundRepeat: "no-repeat",
              WebkitMaskImage: maskUrl,
              maskImage: maskUrl,
              WebkitMaskSize: "contain",
              maskSize: "contain",
              WebkitMaskPosition: "center",
              maskPosition: "center",
              WebkitMaskRepeat: "no-repeat",
              maskRepeat: "no-repeat",
            }}
          />
        </div>
        {/* タイプ名。文字の大きさ・書体・位置は結果ページの実物と同じ。 */}
        <div
          ref={nameRef}
          aria-hidden="true"
          className="pointer-events-none absolute whitespace-nowrap"
          style={{
            left: nameBox.left,
            top: nameBox.top,
            width: nameBox.width,
            height: nameBox.height,
            color: "#FFFFFF",
            fontSize: nameStyle.fontSize,
            fontWeight: nameStyle.fontWeight,
            fontFamily: nameStyle.fontFamily,
            lineHeight: nameStyle.lineHeight,
            letterSpacing: nameStyle.letterSpacing,
            textAlign: nameStyle.textAlign as "center",
          }}
        >
          <div data-side="" className="absolute inset-x-0 flex justify-center" style={{ bottom: "100%", marginBottom: Math.round(nameFont * 0.2) }}>
            <div
              ref={leadRef}
              style={{
                opacity: 0,
                fontSize: Math.max(18, Math.round(nameFont * 0.36)),
                lineHeight: 1.2,
                letterSpacing: "0.2em",
                paddingLeft: "0.2em",
              }}
            >
              あなたは
              <span data-dots="">
                {[0, 1, 2].map((i) => (
                  <span key={i} data-dot="" className="inline-block" style={{ opacity: 0 }}>.</span>
                ))}
              </span>
            </div>
          </div>
          {letters.map((ch, i) => (
            <span key={i} data-letter="" className="inline-block" style={{ opacity: 0 }}>
              {ch}
            </span>
          ))}
        </div>
      </div>
      {/* 発表の光 */}
      <div ref={flashRef} aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ opacity: 0 }} />
      <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  );
}
