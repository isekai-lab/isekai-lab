import { adjacentPoints, fields, findPath, nearby, pointKey, walkable } from './field.ts';
import type { Feature, PlaceId, Point, Scenery } from './field.ts';

const root = document.createElement('main');
root.innerHTML = `<section class="game" id="game"><canvas id="field" aria-label="探索フィールド。タップ、矢印キー、またはWASDで移動できます。" tabindex="0"></canvas><header class="hud"><strong id="place">鐘の村</strong><span>HP 32 / 32</span><button id="menu" type="button">メニュー</button></header><div class="hint" id="hint" aria-live="polite">草の道を歩いて、村を見て回ろう。</div><div class="bottom"><button id="inspect" type="button">しらべる</button><a href="#comments">感想・コメント</a></div><button class="dialogue hidden" id="dialogue" type="button" aria-live="polite" aria-label="会話。押すと閉じます"></button></section><section class="comments" id="comments"><div><h2>感想・コメント</h2><p class="sample">以下は画面モック用の見本コメントです。</p><div id="comment-list"><article class="comment"><b>見本の旅人 A</b><p>橋を渡ると村の奥まで続く感じが好きです。</p></article><article class="comment"><b>見本の旅人 B</b><p>研究所と防衛線を同じ操作で歩き比べられました。</p></article><article class="comment"><b>見本の旅人 C</b><p>木の陰に入る演出がいいですね。</p></article></div><form id="comment-form"><label>なまえ<input id="name" maxlength="24" required></label><label>コメント<textarea id="comment" maxlength="240" required></textarea></label><p>投稿はこの端末内にだけ保存・表示され、外部送信はしません。</p><button>この端末に投稿する</button></form><a class="back" href="#game">ゲームに戻る</a><footer>制作：転生魔法研究所</footer></div></section><dialog id="field-menu"><h2>行き先を選ぶ</h2><p>探索モック：場所切替・移動・会話だけを試せます。既存作品のルールは統合していません。</p><div class="choices"><button data-place="village">鐘の村</button><button data-place="lab">魔法研究所</button><button data-place="frontier">こもれび防衛線</button><button id="reset">初期位置へ戻る</button><button id="comments-link">感想・コメントへ</button><button id="close">閉じる</button></div></dialog>`;
document.body.append(root);

const canvas = document.querySelector<HTMLCanvasElement>('#field')!;
const game = document.querySelector<HTMLElement>('#game')!;
const hint = document.querySelector<HTMLElement>('#hint')!;
const dialogue = document.querySelector<HTMLButtonElement>('#dialogue')!;
const menu = document.querySelector<HTMLDialogElement>('#field-menu')!;
const placeLabel = document.querySelector<HTMLElement>('#place')!;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

let place: PlaceId = 'village';
let player: Point = { ...fields.village.start };
let path: Point[] = [];
let facing: 'up' | 'down' | 'left' | 'right' = 'down';
let walkFrame = 0;
let pending: Feature | undefined;
let movingFrom: Point | undefined;
let motionStart = 0;
let tile = 48;
let cssWidth = 1;
let cssHeight = 1;
let raf = 0;
let intersecting = true;
let pageVisible = !document.hidden;
let dirty = true;
const camera = { x: 0, y: 0 };
const moveDuration = reduced ? 70 : 145;

function current() {
  return fields[place];
}

function isActive(): boolean {
  return intersecting && pageVisible;
}

function requestDraw(): void {
  dirty = true;
  if (isActive() && !raf) raf = requestAnimationFrame(tick);
}

function cancelTravel(): void {
  path = [];
  movingFrom = undefined;
  pending = undefined;
}

function closeDialogue(text = '会話を閉じた。'): void {
  dialogue.classList.add('hidden');
  dialogue.textContent = '';
  hint.textContent = text;
}

function message(text: string, feature?: Feature): void {
  hint.textContent = text;
  if (feature) {
    dialogue.textContent = feature.text;
    dialogue.classList.remove('hidden');
  } else {
    dialogue.classList.add('hidden');
    dialogue.textContent = '';
  }
  requestDraw();
}

function reset(): void {
  cancelTravel();
  player = { ...current().start };
  facing = 'down';
  message('初期位置に戻った。');
}

function choose(next: PlaceId): void {
  place = next;
  placeLabel.textContent = current().name;
  reset();
  menu.close();
}

function arrive(): void {
  if (pending && nearby(current(), player) === pending) message('しらべた。', pending);
  else {
    const found = nearby(current(), player);
    message(found ? '気になるものがある。しらべる？' : '着いた。');
  }
  pending = undefined;
}

function go(goal: Point, feature?: Feature): void {
  cancelTravel();
  const route = findPath(current(), player, goal);
  if (!route) {
    message('そこへは行けない。橋や道を探してみよう。');
    return;
  }
  pending = feature;
  path = route;
  if (!route.length) arrive();
  else {
    message('歩いている…');
    requestDraw();
  }
}

function inspect(): void {
  if (!dialogue.classList.contains('hidden')) {
    closeDialogue();
    return;
  }
  const found = nearby(current(), player);
  if (found) message('しらべた。', found);
  else message('近くに気になるものはない。');
}

function step(dx: number, dy: number): void {
  cancelTravel();
  const goal = { x: player.x + dx, y: player.y + dy };
  facing = dy < 0 ? 'up' : dy > 0 ? 'down' : dx < 0 ? 'left' : 'right';
  if (!walkable(current(), goal)) {
    message('その方向には進めない。');
    return;
  }
  path = [goal];
  message('歩いている…');
}

function tileAt(event: PointerEvent): Point {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.floor((event.clientX - rect.left + camera.x) / tile),
    y: Math.floor((event.clientY - rect.top + camera.y) / tile),
  };
}

canvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  canvas.focus();
  const target = tileAt(event);
  const clicked = current().features.find((feature) => feature.x === target.x && feature.y === target.y);
  if (!clicked) {
    go(target);
    return;
  }
  const choices = adjacentPoints(clicked)
    .map((candidate) => ({ candidate, route: findPath(current(), player, candidate) }))
    .filter((choice): choice is { candidate: Point; route: Point[] } => Boolean(choice.route))
    .sort((a, b) => a.route.length - b.route.length);
  if (!choices[0]) {
    cancelTravel();
    message('そこには近づけない。');
    return;
  }
  go(choices[0].candidate, clicked);
});

document.addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement | null;
  if (!isActive() || menu.open || (target !== canvas && target !== document.body)) return;
  const steps: Record<string, Point> = {
    ArrowUp: { x: 0, y: -1 }, w: { x: 0, y: -1 }, W: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 }, s: { x: 0, y: 1 }, S: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 }, a: { x: -1, y: 0 }, A: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 }, d: { x: 1, y: 0 }, D: { x: 1, y: 0 },
  };
  if (event.key === 'Enter') {
    inspect();
    event.preventDefault();
  } else if (steps[event.key]) {
    step(steps[event.key].x, steps[event.key].y);
    event.preventDefault();
  }
});

document.querySelector('#menu')!.addEventListener('click', () => {
  cancelTravel();
  menu.showModal();
  requestDraw();
});
menu.querySelectorAll<HTMLButtonElement>('[data-place]').forEach((button) => {
  button.addEventListener('click', () => choose(button.dataset.place as PlaceId));
});
document.querySelector('#reset')!.addEventListener('click', reset);
document.querySelector('#close')!.addEventListener('click', () => menu.close());
document.querySelector('#comments-link')!.addEventListener('click', () => {
  cancelTravel();
  menu.close();
  document.querySelector('#comments')!.scrollIntoView();
});
document.querySelector('#inspect')!.addEventListener('click', inspect);
dialogue.addEventListener('click', () => closeDialogue());

function box(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
}

function character(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, direction: string, walking: boolean): void {
  const scale = tile / 48;
  const b = (dx: number, dy: number, width: number, height: number, fill: string): void => box(ctx, x + dx * scale, y + dy * scale, width * scale, height * scale, fill);
  const stride = walking && walkFrame % 2 ? 2 : 0;
  b(-9, 10, 18, 5, '#173026');
  b(-7, -17, 14, 12, '#f2c49f');
  b(-8, -21, 16, 7, color);
  b(-8, -5, 16, 16, color);
  if (direction === 'left' || direction === 'right') {
    const side = direction === 'left' ? -1 : 1;
    b(side * 3 - 1, -13, 2, 2, '#253238');
    b(side * 7 - 1, -6, 3, 7, '#d99d7c');
  } else if (direction === 'down') {
    b(-4, -13, 2, 2, '#253238'); b(3, -13, 2, 2, '#253238');
    b(-2, -9, 4, 2, '#d98e76');
  } else b(-6, -16, 12, 3, '#2f3d43');
  b(-6, 10, 5, 6 + stride, '#263342');
  b(2, 10, 5, 8 - stride, '#263342');
}

function tree(ctx: CanvasRenderingContext2D, x: number, y: number, variant: number): void {
  const s = tile / 48, leaf = ['#487b43', '#3f7442', '#527f40'][variant % 3];
  box(ctx, x - 12 * s, y + 8 * s, 24 * s, 6 * s, '#22472f');
  box(ctx, x - 5 * s, y - 7 * s, 10 * s, 24 * s, '#795239');
  box(ctx, x - 21 * s, y - 30 * s, 42 * s, 18 * s, '#315c38');
  box(ctx, x - 17 * s, y - 39 * s, 34 * s, 18 * s, leaf);
  box(ctx, x - 9 * s, y - 45 * s, 18 * s, 10 * s, '#6a9950');
}

function house(ctx: CanvasRenderingContext2D, x: number, y: number, variant: number, wide = 3): void {
  const s = tile / 48, width = wide * tile, left = x - tile / 2;
  box(ctx, left + 3 * s, y - 48 * s, width - 6 * s, 49 * s, '#c79b6b');
  box(ctx, left, y - 51 * s, width, 8 * s, '#793f35');
  box(ctx, left + 9 * s, y - 64 * s, width - 18 * s, 14 * s, variant ? '#9b493c' : '#a8523d');
  box(ctx, left + 19 * s, y - 73 * s, width - 38 * s, 10 * s, '#bb6548');
  const doorX = left + width / 2 - 8 * s;
  box(ctx, doorX, y - 22 * s, 16 * s, 23 * s, '#67402e');
  box(ctx, left + 14 * s, y - 29 * s, 13 * s, 12 * s, '#83b9bf');
  box(ctx, left + width - 27 * s, y - 29 * s, 13 * s, 12 * s, '#83b9bf');
  box(ctx, left, y + 1 * s, width, 6 * s, '#5b3d2e');
}

function drawScenery(ctx: CanvasRenderingContext2D, object: Scenery, x: number, y: number): void {
  const s = tile / 48;
  if (object.kind === 'tree') tree(ctx, x, y, object.variant ?? 0);
  else if (object.kind === 'house') house(ctx, x, y, object.variant ?? 0);
  else if (object.kind === 'lab') {
    house(ctx, x, y, 1, 7);
    box(ctx, x + tile * 2.75, y - 92 * s, 18 * s, 26 * s, '#8676bd');
    box(ctx, x + tile * 2.82, y - 101 * s, 11 * s, 12 * s, '#c3b2ef');
  } else if (object.kind === 'tower') {
    box(ctx, x - 12 * s, y - 72 * s, tile * 2 - 24 * s, 74 * s, '#c4aa7e');
    box(ctx, x - 17 * s, y - 77 * s, tile * 2 - 14 * s, 9 * s, '#754536');
    box(ctx, x + tile / 2 - 9 * s, y - 58 * s, 18 * s, 18 * s, '#e5c95f');
    box(ctx, x + tile / 2 - 3 * s, y - 53 * s, 6 * s, 8 * s, '#675339');
  } else if (object.kind === 'fence') {
    box(ctx, x - tile / 2, y - 5 * s, tile, 7 * s, '#8c643e');
    box(ctx, x - 17 * s, y - 13 * s, 5 * s, 18 * s, '#b58a54');
    box(ctx, x + 12 * s, y - 13 * s, 5 * s, 18 * s, '#b58a54');
  } else if (object.kind === 'crystal') {
    box(ctx, x - 8 * s, y - 23 * s, 16 * s, 24 * s, '#8176c0');
    box(ctx, x - 3 * s, y - 31 * s, 7 * s, 11 * s, '#c5b8f0');
  } else if (object.kind === 'barricade') {
    house(ctx, x, y, 0, 3);
    box(ctx, x - tile / 2, y - 77 * s, tile * 3, 8 * s, '#6e745b');
  } else {
    box(ctx, x - tile / 2, y - 37 * s, tile * 3, 39 * s, '#64705d');
    box(ctx, x - tile / 2 - 5 * s, y - 45 * s, tile * 3 + 10 * s, 10 * s, '#87906a');
    box(ctx, x + tile - 5 * s, y - 24 * s, 10 * s, 26 * s, '#303a34');
  }
}

function drawFeature(ctx: CanvasRenderingContext2D, feature: Feature, x: number, y: number): void {
  const s = tile / 48;
  if (feature.kind === 'npc') character(ctx, x, y, '#b65b62', 'down', false);
  else if (feature.kind === 'chest') {
    box(ctx, x - 12 * s, y - 13 * s, 24 * s, 15 * s, '#8f5830');
    box(ctx, x - 12 * s, y - 16 * s, 24 * s, 7 * s, '#d4a451');
    box(ctx, x - 2 * s, y - 8 * s, 5 * s, 7 * s, '#f2cf6a');
  } else {
    box(ctx, x - 3 * s, y - 21 * s, 6 * s, 24 * s, '#71472f');
    box(ctx, x - 15 * s, y - 27 * s, 30 * s, 14 * s, '#dfca8f');
    box(ctx, x - 11 * s, y - 23 * s, 22 * s, 2 * s, '#816542');
  }
}

function visualPlayer(time: number): Point {
  if (!movingFrom) return player;
  const progress = Math.min(1, Math.max(0, (time - motionStart) / moveDuration));
  const eased = progress * progress * (3 - 2 * progress);
  return { x: movingFrom.x + (player.x - movingFrom.x) * eased, y: movingFrom.y + (player.y - movingFrom.y) * eased };
}

function draw(time = performance.now()): void {
  if (!isActive()) return;
  const field = current(), ctx = canvas.getContext('2d')!;
  const viewPlayer = visualPlayer(time);
  camera.x = Math.max(0, Math.min(field.width * tile - cssWidth, (viewPlayer.x + .5) * tile - cssWidth / 2));
  camera.y = Math.max(0, Math.min(field.height * tile - cssHeight, (viewPlayer.y + .5) * tile - cssHeight * .58));
  ctx.setTransform(Math.min(devicePixelRatio, 2), 0, 0, Math.min(devicePixelRatio, 2), 0, 0);
  ctx.imageSmoothingEnabled = false;
  const palette = place === 'lab' ? ['#59628b', '#606993', '#9a8fb0'] : place === 'frontier' ? ['#426c4d', '#477451', '#95a064'] : ['#71a55a', '#76aa5e', '#c6b66b'];
  box(ctx, 0, 0, cssWidth, cssHeight, palette[0]);
  const firstX = Math.max(0, Math.floor(camera.x / tile) - 1), lastX = Math.min(field.width - 1, Math.ceil((camera.x + cssWidth) / tile));
  const firstY = Math.max(0, Math.floor(camera.y / tile) - 1), lastY = Math.min(field.height - 1, Math.ceil((camera.y + cssHeight) / tile));
  for (let y = firstY; y <= lastY; y++) {
    for (let x = firstX; x <= lastX; x++) {
      const sx = x * tile - camera.x, sy = y * tile - camera.y, id = pointKey({ x, y });
      box(ctx, sx, sy, tile + 1, tile + 1, (x + y * 3) % 5 ? palette[0] : palette[1]);
      if (field.roads.has(id)) box(ctx, sx, sy, tile + 1, tile + 1, place === 'lab' ? '#77779a' : '#b89b68');
      else if ((x * 7 + y * 11) % 9 === 0) {
        box(ctx, sx + tile * .24, sy + tile * .56, 3, 6, palette[2]);
        box(ctx, sx + tile * .66, sy + tile * .38, 4, 3, '#e0c66c');
      }
      if (field.water.has(id)) {
        box(ctx, sx, sy, tile + 1, tile + 1, '#438da1');
        box(ctx, sx + tile * .1, sy + tile * .28, tile * .45, 3, '#84c4c2');
        box(ctx, sx + tile * .52, sy + tile * .68, tile * .34, 2, '#b0d6ca');
      }
      if (field.bridges.has(id)) {
        box(ctx, sx, sy + tile * .08, tile + 1, tile * .84, '#98663d');
        for (let plank = 0; plank < 4; plank++) box(ctx, sx + plank * tile / 4, sy + tile * .1, 3, tile * .8, '#c18a50');
        box(ctx, sx, sy + tile * .08, tile, 4, '#d5a463');
        box(ctx, sx, sy + tile * .82, tile, 4, '#684733');
      }
    }
  }
  const position = (x: number, y: number): [number, number] => [(x + .5) * tile - camera.x, (y + .78) * tile - camera.y];
  const objects: { y: number; render: () => void }[] = [];
  for (const object of field.scenery) {
    const [x, y] = position(object.x, object.y);
    objects.push({ y: object.y + .5, render: () => drawScenery(ctx, object, x, y) });
  }
  for (const feature of field.features) {
    const [x, y] = position(feature.x, feature.y);
    objects.push({ y: feature.y + .7, render: () => drawFeature(ctx, feature, x, y) });
  }
  const [px, py] = position(viewPlayer.x, viewPlayer.y);
  objects.push({ y: viewPlayer.y + .75, render: () => character(ctx, px, py, '#4c62ad', facing, Boolean(movingFrom)) });
  objects.sort((a, b) => a.y - b.y).forEach((object) => object.render());
  dirty = false;
}

function beginNext(time: number): void {
  const next = path.shift();
  if (!next) return;
  movingFrom = { ...player };
  facing = next.y < player.y ? 'up' : next.y > player.y ? 'down' : next.x < player.x ? 'left' : 'right';
  player = next;
  motionStart = time;
  walkFrame++;
}

function tick(time: number): void {
  raf = 0;
  if (!isActive()) return;
  if (!movingFrom && path.length && !menu.open) beginNext(time);
  if (movingFrom && time - motionStart >= moveDuration) {
    movingFrom = undefined;
    if (path.length && !menu.open) beginNext(time);
    else arrive();
  }
  if (dirty || movingFrom) draw(time);
  if ((movingFrom || path.length || dirty) && !raf) raf = requestAnimationFrame(tick);
}

function resizeCanvas(): void {
  const rect = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio, 2);
  cssWidth = Math.max(1, rect.width);
  cssHeight = Math.max(1, rect.height);
  const preferredTile = Math.min(64, Math.max(48, Math.round(Math.min(cssWidth / (cssWidth > cssHeight ? 18 : 8), cssHeight / (cssWidth > cssHeight ? 11 : 14)))));
  tile = Math.max(preferredTile, Math.ceil(cssWidth / current().width), Math.ceil(cssHeight / current().height));
  const width = Math.round(cssWidth * dpr), height = Math.round(cssHeight * dpr);
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  requestDraw();
}

new ResizeObserver(resizeCanvas).observe(game);
new IntersectionObserver(([entry]) => {
  intersecting = entry.isIntersecting;
  if (!intersecting && raf) { cancelAnimationFrame(raf); raf = 0; }
  else requestDraw();
}).observe(game);
document.addEventListener('visibilitychange', () => {
  pageVisible = !document.hidden;
  if (!pageVisible && raf) { cancelAnimationFrame(raf); raf = 0; }
  else requestDraw();
});
resizeCanvas();

const form = document.querySelector<HTMLFormElement>('#comment-form')!;
const list = document.querySelector('#comment-list')!;
function appendComment(name: string, text: string): void {
  const article = document.createElement('article'), author = document.createElement('b'), body = document.createElement('p');
  article.className = 'comment'; author.textContent = `${name}（この端末の投稿）`; body.textContent = text;
  article.append(author, body); list.prepend(article);
}
form.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = document.querySelector<HTMLInputElement>('#name')!, comment = document.querySelector<HTMLTextAreaElement>('#comment')!;
  appendComment(name.value, comment.value);
  try {
    const saved: unknown = JSON.parse(localStorage.getItem('isekai-field-comments') ?? '[]');
    if (Array.isArray(saved)) {
      saved.unshift({ name: name.value, text: comment.value });
      localStorage.setItem('isekai-field-comments', JSON.stringify(saved.slice(0, 10)));
    }
  } catch { /* Storage may be disabled; the in-memory comment still works. */ }
  form.reset();
});
try {
  const saved: unknown = JSON.parse(localStorage.getItem('isekai-field-comments') ?? '[]');
  if (Array.isArray(saved)) saved.slice(0, 10).reverse().forEach((item: unknown) => {
    if (item && typeof item === 'object' && 'name' in item && 'text' in item && typeof item.name === 'string' && typeof item.text === 'string') appendComment(item.name, item.text);
  });
} catch { /* The mock remains usable without local storage. */ }
