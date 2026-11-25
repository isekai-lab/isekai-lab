import { PALETTE } from '../../common/assets/sprites.ts';
import { sprite } from '../../common/src/pixel.ts';
import { GAME_SPRITES } from '../assets/sprites.ts';
import type { StoryChoice } from './model.ts';
export type SceneAction = {
    node: string;
    choice: StoryChoice;
    index: number;
};
const W = 640, H = 288, PX = 4;
type Position = { x: number; y: number };
const places: Record<string, Position & { label: string }> = {
  start: { label: '森の入口', x: 304, y: 220 },
  hut: { label: '薬草小屋', x: 160, y: 202 },
  library: { label: '古い図書庫', x: 164, y: 202 },
  pond: { label: '青い泉', x: 198, y: 204 },
  bridge: { label: '古い吊り橋', x: 134, y: 200 },
  traveler: { label: '旅人の木陰', x: 155, y: 205 },
  branches: { label: '落ち枝の道', x: 162, y: 204 },
  shadow: { label: '村の入口', x: 152, y: 204 },
  bell: { label: '鐘楼', x: 171, y: 205 }
};
const paths: Record<string, Position[]> = {
  'start:0': [{ x: 400, y: 220 }, { x: 536, y: 208 }],
  'start:1': [{ x: 220, y: 220 }, { x: 112, y: 208 }],
  'hut:0': [{ x: 388, y: 202 }], 'hut:1': [{ x: 388, y: 202 }],
  'library:0': [{ x: 384, y: 202 }], 'library:1': [{ x: 384, y: 202 }],
  'pond:0': [{ x: 352, y: 202 }], 'pond:1': [{ x: 304, y: 232 }, { x: 576, y: 204 }],
  'bridge:0': [{ x: 204, y: 165 }, { x: 504, y: 165 }, { x: 548, y: 201 }],
  'bridge:1': [{ x: 188, y: 238 }, { x: 512, y: 238 }, { x: 548, y: 201 }],
  'traveler:0': [{ x: 430, y: 202 }], 'traveler:1': [{ x: 430, y: 202 }],
  'branches:0': [{ x: 376, y: 202 }], 'branches:1': [{ x: 556, y: 202 }],
  'shadow:0': [{ x: 364, y: 202 }], 'shadow:1': [{ x: 436, y: 202 }, { x: 548, y: 202 }],
  'bell:0': [{ x: 448, y: 202 }], 'bell:1': [{ x: 448, y: 202 }]
};
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export function sceneRoute(action: SceneAction, progress: number): Position {
  const key = action.node + ':' + action.index;
  const points = [places[action.node] ?? places.start, ...(paths[key] ?? [{ x: 500, y: 202 }])];
  const distance = clamp(progress / .56, 0, 1) * (points.length - 1);
  const segment = Math.min(points.length - 2, Math.floor(distance));
  const t = distance - segment;
  const from = points[segment], to = points[segment + 1];
  return { x: Math.round(from.x + (to.x - from.x) * t), y: Math.round(from.y + (to.y - from.y) * t) };
}
function gs(ctx: CanvasRenderingContext2D, name: keyof typeof GAME_SPRITES, x: number, y: number, size = PX, flip = false): void {
    const pixels = GAME_SPRITES[name], width = Math.max(...pixels.map(row => row.length));
    ctx.save();
    ctx.translate(Math.round(x / PX) * PX, Math.round(y / PX) * PX);
    if (flip) {
        ctx.translate(width * size, 0);
        ctx.scale(-1, 1);
    }
    for (let row = 0; row < pixels.length; row++)
        for (let col = 0; col < pixels[row].length; col++) {
            const colour = PALETTE[pixels[row][col]];
            if (colour) {
                ctx.fillStyle = colour;
                ctx.fillRect(col * size, row * size, size, size);
            }
        }
    ctx.restore();
}
export class StoryScene {
    private ctx: CanvasRenderingContext2D;
    private node = 'start';
    private action: SceneAction | null = null;
    private finale: SceneAction | null = null;
    private started = 0;
    private raf = 0;
    private visible = true;
    private finish: (() => void) | null = null;
    private abort: (() => void) | null = null;
    private reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    private onStatus: (s: string) => void;
    constructor(canvas: HTMLCanvasElement, onStatus: (text: string) => void) {
        this.ctx = canvas.getContext('2d')!;
        this.onStatus = onStatus;
        this.ctx.imageSmoothingEnabled = false;
        document.addEventListener('visibilitychange', this.onVisibility);
        this.raf = requestAnimationFrame(t => this.frame(t));
    }
    setNode(node: string): void {
        this.node = node;
        this.action = null;
        this.finale = null;
        this.finish = null;
        this.abort = null;
        this.onStatus('周囲を見渡している');
    }
    isBusy(): boolean { return this.action !== null; }
    play(action: SceneAction, done: () => void, aborted: () => void): void {
        if (this.action) return;
        this.finale = null;
        this.action = action;
        this.started = performance.now();
        this.finish = done;
        this.abort = aborted;
        this.onStatus(this.actionText(action));
    }
    finishOutcome(clear: boolean, _defeated: boolean): void {
        if (clear) {
            this.onStatus('鐘が止まり、村が目を覚ました');
        } else {
            this.node = 'start';
            this.action = null;
            this.finale = null;
            this.finish = null;
            this.abort = null;
            this.onStatus('森の入口で目を覚ました。記憶は残っている');
        }
        this.draw(performance.now());
    }
    dispose(): void {
        cancelAnimationFrame(this.raf);
        document.removeEventListener('visibilitychange', this.onVisibility);
    }
    private onVisibility = (): void => {
        this.visible = !document.hidden;
        if (!this.visible && this.action) {
            const abort = this.abort;
            this.action = null;
            this.finish = null;
            this.abort = null;
            this.onStatus('行動を中断した。もう一度選べる');
            abort?.();
        }
    };
    private frame(now: number): void {
        this.draw(now);
        if (this.action && this.visible && now - this.started >= (this.reduced ? 80 : 1350)) {
            const completed = this.action, done = this.finish;
            this.action = null;
            this.finish = null;
            this.abort = null;
            this.finale = completed;
            done?.();
        }
        this.raf = requestAnimationFrame(t => this.frame(t));
    }
    private draw(now: number): void {
        const c = this.ctx;
        c.clearRect(0, 0, W, H);
        this.background(c, this.node, now);
        const t = this.action ? clamp((now - this.started) / (this.reduced ? 80 : 1350), 0, 1) : this.finale ? 1 : 0;
        const action = this.action ?? this.finale;
        const from = places[this.node] ?? places.start;
        const position = action ? sceneRoute(action, t) : from;
        const walking = !!this.action && t < .56;
        const bob = !this.reduced && walking && Math.sin(now / 75) > 0 ? -PX : 0;
        const x = Math.round(position.x / PX) * PX, y = Math.round(position.y / PX) * PX + bob;
        this.interaction(c, this.reduced ? 0 : now, t, x, y, action);
        const crouching = action?.node === 'pond' && action.index === 0 && t >= .56;
        sprite(c, 'hero', x - 28, y - 64 + (crouching ? 12 : 0), PX, walking && position.x > from.x);
        if (walking)
            this.feet(c, x, y, this.reduced ? 0 : now);
        this.label(c, (places[this.node] ?? places.start).label);
        if (this.action)
            this.banner(c, this.actionText(this.action));
    }
    private background(c: CanvasRenderingContext2D, node: string, now: number): void {
        const dark = node === 'shadow' || node === 'bell';
        c.fillStyle = dark ? '#596d6a' : '#a7c5b2';
        c.fillRect(0, 0, W, H);
        c.fillStyle = dark ? '#71866e' : '#bdd77b';
        c.fillRect(0, 108, W, 180);
        c.fillStyle = '#d9c891';
        c.fillRect(0, 216, W, 72);
        for (let i = 0; i < 10; i++)
            sprite(c, 'tree', i * 72 - 24, 20 + (i % 3) * 12, PX);
        for (let i = 0; i < 54; i++) {
            c.fillStyle = i % 5 ? '#74a86a' : '#e9bd64';
            c.fillRect(Math.floor(((i * 76 + 12) % W) / PX) * PX, Math.floor((144 + (i * 29) % 68) / PX) * PX, PX, PX);
        }
        c.fillStyle = '#c4ad73';
        c.fillRect(0, 204, W, 28);
        this.prop(c, node, now);
        if (node !== 'pond')
            this.bugs(c, now);
    }
    private prop(c: CanvasRenderingContext2D, node: string, now: number): void {
        if (node === 'start') {
            gs(c, 'libraryLarge', 24, 76);
            gs(c, 'hutLarge', 456, 80);
            this.text(c, '← 図書庫', 44, 66);
            this.text(c, '薬草小屋 →', 464, 66);
            c.fillStyle = '#283a38';
            c.fillRect(268, 156, 8, 40);
            c.fillRect(244, 152, 60, 24);
            c.fillStyle = '#a68361';
            c.fillRect(248, 156, 52, 16);
            this.text(c, '森の入口', 250, 168);
        }
        else if (node === 'hut') {
            gs(c, 'hutLarge', 400, 76);
            c.fillStyle = '#77594d';
            c.fillRect(400, 188, 72, 8);
            c.fillRect(404, 196, 8, 12);
            c.fillRect(460, 196, 8, 12);
            gs(c, 'oil', 400, 160);
            gs(c, 'bottle', 436, 160);
            this.text(c, '薬草小屋　油 / 水筒', 398, 62);
        }
        else if (node === 'library') {
            gs(c, 'libraryLarge', 384, 76);
            gs(c, 'book', 400, 172);
            this.text(c, '古い図書庫　本 / 布', 396, 62);
        }
        else if (node === 'pond') {
            gs(c, 'pondLarge', 340, 120);
            c.fillStyle = '#fcf2d5';
            c.fillRect(404 + (this.reduced ? 0 : Math.floor(now / 300) % 2 * 8), 176, 28, PX);
            this.text(c, '青い泉（しん…）', 386, 104);
        }
        else if (node === 'bridge') {
            c.fillStyle = '#7185b0';
            c.fillRect(180, 160, 344, 128);
            for (let i = 0; i < 18; i++) {
                c.fillStyle = i % 3 ? '#46577c' : '#fcf2d5';
                c.fillRect(196 + (i * 76) % 300, 180 + (i * 12) % 108, 16, PX);
            }
            c.fillStyle = '#77594d';
            c.fillRect(172, 164, 8, 124);
            c.fillRect(524, 164, 8, 124);
            c.fillStyle = '#d9c891';
            c.fillRect(0, 204, 172, 84);
            c.fillRect(532, 204, 108, 84);
            gs(c, 'bridgeLarge', 172, 100);
            for (let x = 188; x < 532; x += 44)
                gs(c, 'stone', x, 228);
            this.text(c, '腐った吊り橋 / 石の浅瀬', 214, 88);
        }
        else if (node === 'traveler') {
            gs(c, 'traveler', 442, 144, PX, true);
            gs(c, 'bag', 500, 176);
            this.text(c, 'うとうとする旅人 / かばん', 398, 124);
        }
        else if (node === 'branches') {
            for (let i = 0; i < 3; i++)
                gs(c, 'branch', 360 + i * 60, 160 + i % 2 * 16, PX, i % 2 === 1);
            this.text(c, '乾いた落ち枝', 418, 142);
        }
        else if (node === 'shadow') {
            const progress = this.action?.node === 'shadow' && this.action.index === 0 ? clamp(((now - this.started) / (this.reduced ? 80 : 1350) - .5) * 2, 0, 1) : 0;
            c.save();
            c.globalAlpha = 1 - progress * .45;
            gs(c, 'shadow', 408 + Math.round(progress * 80), 112);
            c.restore();
            this.text(c, '鐘楼を守る影', 414, 96, '#fcf2d5');
        }
        else if (node === 'bell') {
            gs(c, 'bellLarge', 448, 36);
            this.text(c, '鐘楼', 466, 26, '#fcf2d5');
        }
    }
    private bugs(c: CanvasRenderingContext2D, now: number): void {
        const frame = !this.reduced && Math.floor(now / 180) % 3 === 2;
        [[252, 120], [568, 164]].forEach(([x, y], i) => {
            const dx = this.reduced ? 0 : Math.round(Math.sin(now / 700 + i) * 2) * PX;
            const dy = this.reduced ? 0 : Math.round(Math.cos(now / 520 + i) * 2) * PX;
            gs(c, frame ? 'butterflyB' : 'butterflyA', x + dx, y + dy);
        });
    }
    private feet(c: CanvasRenderingContext2D, x: number, y: number, now: number): void { c.fillStyle = '#283a38'; const s = Math.sin(now / 75) > 0 ? 8 : 0; c.fillRect(x - 16 + s, y - 4, 12, 4); c.fillRect(x + 4 - s, y - 4, 12, 4); }
    private interaction(c: CanvasRenderingContext2D, now: number, t: number, x: number, y: number, action: SceneAction | null): void {
        if (!action || t < .5)
            return;
        const key = `${action.node}:${action.index}`;
        if (key === 'hut:0')
            gs(c, 'oil', x + 20, y - 52);
        else if (key === 'hut:1')
            gs(c, 'bottle', x + 20, y - 52);
        else if (key === 'library:0' || key === 'traveler:0') {
            c.fillStyle = '#283a38';
            c.fillRect(x + 20, y - 48, 32, 20);
            c.fillStyle = key === 'library:0' ? '#ae8dad' : '#fcf2d5';
            c.fillRect(x + 24, y - 44, 24, 12);
            c.fillStyle = '#7185b0';
            c.fillRect(x + 32, y - 44, 4, 12);
        }
        else if (key === 'library:1')
            gs(c, 'book', x + 20, y - 52);
        else if (key === 'pond:0') {
            c.fillStyle = '#7185b0';
            c.fillRect(x + 12, y - 28, 20, 8);
            c.fillStyle = '#ae8dad';
            for (let i = 0; i < 6; i++)
                c.fillRect(x - 12 + i * 8, y - 72 - Math.round(Math.sin(now / 140 + i)) * PX, PX, PX);
        }
        else if (key === 'bridge:0') {
            c.fillStyle = '#a68361';
            c.fillRect(388, 172 + Math.floor((t - .5) * 8) * PX, 24, 8);
            this.text(c, 'ミシッ', 376, 132, '#fcf2d5');
        }
        else if (key === 'bridge:1') {
            c.fillStyle = '#fcf2d5';
            c.fillRect(468, 244, 24, PX);
            c.fillRect(476, 252, 16, PX);
        }
        else if (key === 'traveler:1')
            gs(c, 'bottle', x + 20, y - 52);
        else if (key === 'branches:0' || key === 'shadow:0')
            gs(c, 'torch', x + 12, y - 76);
        else if (key === 'bell:0')
            gs(c, 'bellCloth', 464, 88);
        else if (key === 'bell:1') {
            c.fillStyle = '#77594d';
            c.fillRect(x + 12, y - 48, 28, 8);
            c.fillStyle = '#46577c';
            c.fillRect(x + 32, y - 60, 12, 24);
            c.fillStyle = '#fcf2d5';
            c.fillRect(x + 32, y - 60, 12, PX);
        }
    }
    private actionText(a: SceneAction): string { const text: Record<string, string> = { 'start:0': '森の道を歩き、薬草小屋へ…', 'start:1': '分かれ道を曲がり、図書庫へ…', 'hut:0': '油の小瓶を手に取っている…', 'hut:1': '水筒を手に取っている…', 'library:0': '色あせた布を取り出している…', 'library:1': '灯りの作り方を調べている…', 'pond:0': '泉の水を飲んでいる…', 'pond:1': '泉のほとりを歩いている…', 'bridge:0': '腐った板を急いで渡っている…', 'bridge:1': '浅瀬を一歩ずつ渡っている…', 'traveler:0': '旅人から包帯を受け取っている…', 'traveler:1': '旅人の傷薬で手当てしている…', 'branches:0': '枝に油を染みこませ、火を灯している…', 'branches:1': '落ち枝のそばを通っている…', 'shadow:0': '灯りをかざし、影を遠ざけている…', 'shadow:1': '影の隙間を駆け抜けている…', 'bell:0': '鐘を布で包んでいる…', 'bell:1': '鐘を叩こうとしている…' }; return text[`${a.node}:${a.index}`] ?? '目的の場所へ歩いている…'; }
    private text(c: CanvasRenderingContext2D, s: string, x: number, y: number, col = '#283a38'): void { c.fillStyle = col; c.font = '12px sans-serif'; c.fillText(s, x, y); }
    private label(c: CanvasRenderingContext2D, s: string): void { c.fillStyle = '#243d35cc'; c.fillRect(12, 12, Math.max(112, s.length * 13), 28); this.text(c, s, 24, 32, '#fcf2d5'); }
    private banner(c: CanvasRenderingContext2D, s: string): void { c.fillStyle = '#243d35df'; c.fillRect(12, 244, 616, 32); this.text(c, s, 24, 266, '#fcf2d5'); }
}
