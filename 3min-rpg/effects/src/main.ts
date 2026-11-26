import { installSpriteSheetShape, preloadSpriteSheet } from '../../common/vfx/sprite-sheet.ts';
import { MAGIC_EFFECTS, magicEffectEmitter, playMagicEffect } from '../../common/vfx/magic-effects.ts';
type Container = { addEmitter: (emitter: unknown) => Promise<unknown>; pause: () => void; play: () => void; particles: { clear: () => void } };
declare const tsParticles: { pluginManager: { addShape: (names: string[], drawer: () => Promise<unknown>) => void }; load: (options: Record<string, unknown>) => Promise<Container> };
declare const loadFull: (engine: unknown) => Promise<void>;
let selected = MAGIC_EFFECTS.find(effect => effect.id === 'fx3_fireBall') ?? MAGIC_EFFECTS[0], container: Container | undefined, token = 0;
const auto = !matchMedia('(prefers-reduced-motion: reduce)').matches;
const app = document.createElement('main'); app.className = 'effect-catalog';
app.innerHTML = `<header><h1>魔法エフェクトカタログ</h1><p>炎・雷・魔法陣など、33件（バリエーション含む）のCC0アニメーション素材です。</p></header><section class="catalog-tools"><label>検索 <input type="search" placeholder="炎、転移、泡…"></label><label>分類 <select><option value="">すべて</option></select></label></section><section class="preview"><div class="stage"><div id="magic-preview"></div></div><div><h2></h2><p class="provenance"></p><p class="status" role="status">読み込み中…</p><button type="button" class="play">▶ 再生</button><button type="button" class="download">JSONを保存</button><button type="button" class="theme">明るい背景</button><details><summary>JSONとローダーについて</summary><p>JSONには画像と再生設定を含みます。標準のtsParticlesだけではスプライトシートを再生できないため、先に <code>installSpriteSheetShape</code> を登録してください。</p></details></div></section><section class="cards" aria-label="エフェクト一覧"></section><footer>CC0素材: Para「Animated particle effects #1 / #2」・Mikodrak「2D Spell Effects」</footer>`;
document.body.append(app);
const search = app.querySelector('input') as HTMLInputElement, category = app.querySelector('select') as HTMLSelectElement, cards = app.querySelector('.cards') as HTMLElement, name = app.querySelector('h2') as HTMLElement, provenance = app.querySelector('.provenance') as HTMLElement, status = app.querySelector('.status') as HTMLElement, play = app.querySelector('.play') as HTMLButtonElement;
for (const value of [...new Set(MAGIC_EFFECTS.map(effect => effect.category))]) category.add(new Option(value, value));
function selectInfo(): void { name.textContent = selected.name; const link = Object.assign(document.createElement('a'), { href: selected.sourceURL, textContent: selected.source, target: '_blank', rel: 'noreferrer' }); provenance.replaceChildren('出典: ', link, document.createTextNode(' / CC0')); for (const card of Array.from(cards.querySelectorAll<HTMLButtonElement>('.card'))) card.setAttribute('aria-pressed', String(card.dataset.id === selected.id)); }
async function thumb(canvas: HTMLCanvasElement, effect: typeof selected): Promise<void> { try { const image = await preloadSpriteSheet(effect.sheet), frame = Math.min(effect.sheet.frameCount - 1, Math.floor(effect.sheet.frameCount / 3)), ctx = canvas.getContext('2d'); if (!ctx) return; ctx.drawImage(image, frame % effect.sheet.columns * effect.sheet.frameWidth, Math.floor(frame / effect.sheet.columns) * effect.sheet.frameHeight, effect.sheet.frameWidth, effect.sheet.frameHeight, 0, 0, 64, 64); } catch { canvas.title = 'サムネイルを読み込めませんでした'; } }
function render(): void {
  const term = search.value.trim().toLocaleLowerCase();
  const visible = MAGIC_EFFECTS.filter(effect => (!category.value || effect.category === category.value)
    && `${effect.name} ${effect.category}`.toLocaleLowerCase().includes(term));
  cards.replaceChildren(...visible.map(effect => {
    const card = document.createElement('button'), canvas = document.createElement('canvas'), small = document.createElement('small');
    card.type = 'button'; card.className = 'card'; card.dataset.id = effect.id;
    card.setAttribute('aria-pressed', String(effect.id === selected.id));
    canvas.width = canvas.height = 64; canvas.setAttribute('aria-hidden', 'true');
    small.textContent = effect.category;
    card.append(canvas, document.createTextNode(effect.name), small);
    void thumb(canvas, effect);
    card.onclick = () => {
      selected = effect; token++; selectInfo();
      app.querySelector('.preview')?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
      void replay();
    };
    return card;
  }));
}
async function replay(): Promise<void> {
  const current = token, effect = selected;
  if (!container) return;
  try {
    status.textContent = `${effect.name} を準備中…`;
    await preloadSpriteSheet(effect.sheet);
    if (current !== token) return;
    container.particles.clear();
    container.play();
    await playMagicEffect(container, effect);
    if (current !== token) return;
    status.textContent = `${effect.name} を再生中`;
    window.setTimeout(() => {
      if (current === token) status.textContent = `${effect.duration.toFixed(2)}秒のアニメーション · もう一度再生できます`;
    }, effect.duration * 1000 + 80);
  } catch (error) {
    if (current === token) status.textContent = `再生エラー: ${error instanceof Error ? error.message : String(error)}`;
  }
}
function download(): void { const json = { format: 'isekai-lab.magic-effect.v1', effect: selected, emitter: magicEffectEmitter(selected), loader: { required: 'installSpriteSheetShape(tsParticles) before loadFull/tsParticles.load', shape: 'magic-sprite-sheet' }, provenance: { sourceURL: selected.sourceURL, author: selected.author, license: selected.license } }, url = URL.createObjectURL(new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' })), anchor = Object.assign(document.createElement('a'), { href: url, download: `${selected.id}.magic-effect.json` }); document.body.append(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url); }
search.oninput = render; category.onchange = render; play.onclick = () => { token++; void replay(); }; (app.querySelector('.download') as HTMLButtonElement).onclick = download; (app.querySelector('.theme') as HTMLButtonElement).onclick = event => { app.classList.toggle('light'); (event.currentTarget as HTMLButtonElement).textContent = app.classList.contains('light') ? '暗い背景' : '明るい背景'; }; selectInfo(); render();
async function initialize(): Promise<void> { try { installSpriteSheetShape(tsParticles); await loadFull(tsParticles); container = await tsParticles.load({ id: 'magic-preview', options: { fullScreen: { enable: false }, detectRetina: false, pauseOnOutsideViewport: true, pauseOnBlur: true, particles: { number: { value: 0 } }, emitters: [] } }); status.textContent = auto ? '選択した魔法を再生できます' : '動きを減らす設定です。再生ボタンで手動再生できます。'; if (auto) await replay(); } catch (error) { status.textContent = `初期化エラー: ${error instanceof Error ? error.message : String(error)}`; play.disabled = true; } }
void initialize(); document.addEventListener('visibilitychange', () => { if (document.hidden) container?.pause(); else if (auto) container?.play(); });
