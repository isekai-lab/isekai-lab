import { $, recordLeaf, shell, toast } from '../../common/src/ui.ts';
import { forest, sprite } from '../../common/src/pixel.ts';
import { arenaStep, arenaUpgrade, newArena } from './model.ts';
import type { Upgrade } from './model.ts';
let arena = newArena(); let playing = false; let paused = false; let recordedArena = false;
shell('こもれび防衛線', '三分間の森の冒険。行き先を選んで、小さな魔法を育てよう。', '<section class="panel"><div id="status" class="statusbar"></div><div class="arena-wrap"><canvas id="arena" class="scene arena" width="640" height="420" tabindex="0" aria-label="クリックかタッチで移動。攻撃は自動。キーボードは矢印キーでも移動できます。"></canvas><div id="overlay" class="overlay"></div></div><div class="arena-help">マウスで行き先をクリック。スマホはタップ・ドラッグ。<br>攻撃は自動です。落ちた光を拾うと、魔法が成長します。</div><div class="panel-body"><div class="actions" style="margin-top:0"><button id="pause">一時停止</button><button id="restart" class="hide">もう一度遊ぶ</button></div><p id="arena-note" class="notice">三分間生き延びるとクリア。休憩中や成長の選択中は、時間が止まります。</p></div></section>', 'EXPERIMENT 03 / ACTION RPG');
const canvas = $<HTMLCanvasElement>('#arena'), ctx = canvas.getContext('2d')!;
ctx.imageSmoothingEnabled = false;
function arenaStatus(): void {
  const left = Math.max(0, Math.ceil(180 - arena.elapsed)), minute = Math.floor(left / 60), second = String(left % 60).padStart(2, '0');
  $('#status').innerHTML = `<span>残り <strong>${minute}:${second}</strong></span><span class="hp">体力 <strong>${arena.hp} / ${arena.maxHp}</strong></span><span>Lv. ${arena.level}</span><span>討伐 ${arena.kills}</span>`;
}
function showArenaOverlay(): void {
  const overlay = $('#overlay');
  $('#pause').textContent = paused ? '再開する' : '一時停止';
  $<HTMLButtonElement>('#pause').disabled = !playing || arena.ended || arena.upgrading;
  $('#restart').classList.toggle('hide', !arena.ended);
  if (!playing) {
    overlay.classList.remove('hide'); overlay.innerHTML = '<div class="overlay-content"><div class="eyebrow" style="color:#e6d99f">THREE MINUTES IN THE WOODS</div><h2>森へ、ひと足。</h2><p>移動して敵をよけ、光を集める。<br>攻撃は、魔法の葉におまかせ。</p><button id="start" class="primary">冒険をはじめる</button></div>';
    $('#start').addEventListener('click', () => { playing = true; paused = false; showArenaOverlay(); }); return;
  }
  if (arena.ended) {
    if (!recordedArena) { recordedArena = true; recordLeaf('こもれび防衛線', arena.clear ? '木漏れ日を守った葉' : '森で育てた、小さな魔法', `${Math.floor(arena.elapsed)}秒の冒険。Lv.${arena.level}、討伐${arena.kills}体。${arena.clear ? '森に朝が戻った。' : '次は光を集めて、もっと魔法を育てよう。'}`, arena.clear ? 'clear' : 'memory'); }
    overlay.classList.remove('hide'); overlay.innerHTML = `<div class="overlay-content"><h2>${arena.clear ? '森に、朝が戻った。' : '冒険は、葉になった。'}</h2><p>${Math.floor(arena.elapsed)}秒 / Lv.${arena.level} / 討伐 ${arena.kills}体</p><button class="primary" id="retry-arena">もう一度、森へ</button></div>`;
    $('#retry-arena').addEventListener('click', resetArena); return;
  }
  if (arena.upgrading) {
    overlay.classList.remove('hide'); overlay.innerHTML = `<div class="overlay-content"><h2>葉が一枚、育った。</h2><p>Lv.${arena.level} · 次の魔法を選ぼう</p><div class="upgrade-list"><button data-upgrade="power">❧ 枝の矢を強くする<small>攻撃力 +2</small></button><button data-upgrade="haste">ϟ 詠唱を短くする<small>攻撃間隔 −20%</small></button><button data-upgrade="heal">♡ 木漏れ日でひと休み<small>体力 +7</small></button></div></div>`;
    overlay.querySelectorAll<HTMLButtonElement>('[data-upgrade]').forEach(button => button.addEventListener('click', () => { arenaUpgrade(arena, button.dataset.upgrade as Upgrade); showArenaOverlay(); })); return;
  }
  if (paused) {
    overlay.classList.remove('hide'); overlay.innerHTML = '<div class="overlay-content"><h2>木陰でひと休み。</h2><p>時間は止まっています。</p><button class="primary" id="resume">冒険を続ける</button></div>';
    $('#resume').addEventListener('click', () => { paused = false; showArenaOverlay(); }); return;
  }
  overlay.classList.add('hide');
}
function resetArena(): void { arena = newArena(); playing = true; paused = false; recordedArena = false; keys.clear(); showArenaOverlay(); arenaStatus(); }
$('#pause').addEventListener('click', () => { paused = !paused; showArenaOverlay(); });
$('#restart').addEventListener('click', resetArena);
function setTarget(event: PointerEvent): void {
  const rect = canvas.getBoundingClientRect(); arena.target = { x: (event.clientX - rect.left) / rect.width * arena.width, y: (event.clientY - rect.top) / rect.height * arena.height };
}
let pointerHeld = false;
canvas.addEventListener('pointerdown', event => { if (!playing || paused || arena.ended || arena.upgrading) return; event.preventDefault(); pointerHeld = true; canvas.setPointerCapture(event.pointerId); setTarget(event); canvas.focus({ preventScroll: true }); });
canvas.addEventListener('pointermove', event => { if (pointerHeld) setTarget(event); });
canvas.addEventListener('pointerup', () => { pointerHeld = false; });
canvas.addEventListener('pointercancel', () => { pointerHeld = false; });
const keys = new Set<string>();
canvas.addEventListener('keydown', event => { if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(event.key)) { event.preventDefault(); keys.add(event.key); } });
window.addEventListener('keyup', event => keys.delete(event.key));
function safePause(): void { keys.clear(); pointerHeld = false; if (playing && !arena.ended) { paused = true; showArenaOverlay(); } }
window.addEventListener('blur', safePause);
document.addEventListener('visibilitychange', () => { if (document.hidden) safePause(); });
let previous = 0, previousStatus = 0;
function frame(now: number): void {
  const dt = previous ? Math.min((now - previous) / 1000, .05) : 0; previous = now;
  if (playing && !paused && !arena.ended && !arena.upgrading && !$<HTMLDialogElement>('#leaf-dialog').open) {
    const dx = Number(keys.has('ArrowRight') || keys.has('d')) - Number(keys.has('ArrowLeft') || keys.has('a'));
    const dy = Number(keys.has('ArrowDown') || keys.has('s')) - Number(keys.has('ArrowUp') || keys.has('w'));
    if (dx || dy) { const d = Math.hypot(dx, dy); arena.target = { x: arena.player.x + dx / d * 30, y: arena.player.y + dy / d * 30 }; }
    arenaStep(arena, dt);
    if (arena.upgrading || arena.ended) showArenaOverlay();
  }
  forest(ctx, arena.width, arena.height);
  for (const gem of arena.gems) { ctx.fillStyle = '#f6d87a'; ctx.fillRect(Math.round(gem.x) - 3, Math.round(gem.y) - 3, 6, 6); ctx.fillStyle = '#fff6bd'; ctx.fillRect(Math.round(gem.x) - 1, Math.round(gem.y) - 4, 2, 2); }
  for (const mob of arena.mobs) { if (mob.hit) ctx.globalAlpha = .45; const scale = mob.kind === 'golem' ? 3 : 2; sprite(ctx, mob.kind, mob.x - 8 * scale, mob.y - 8 * scale, scale); ctx.globalAlpha = 1; }
  for (const shot of arena.shots) { ctx.fillStyle = '#fff5c7'; ctx.fillRect(shot.x - 4, shot.y - 2, 8, 4); }
  if (!(arena.invulnerable && Math.floor(now / 70) % 2)) sprite(ctx, 'hero', arena.player.x - 16, arena.player.y - 22, 2);
  if (playing && !arena.ended) { ctx.strokeStyle = '#3e715875'; ctx.beginPath(); ctx.arc(arena.target.x, arena.target.y, 7, 0, Math.PI * 2); ctx.stroke(); }
  const threshold = 4 + arena.level * 2;
  ctx.fillStyle = '#394f3b88'; ctx.fillRect(15, 15, 140, 7); ctx.fillStyle = '#dfc575'; ctx.fillRect(15, 15, 140 * Math.min(1, arena.xp / threshold), 7);
  if (now - previousStatus > 200) { arenaStatus(); previousStatus = now; }
  requestAnimationFrame(frame);
}
showArenaOverlay(); arenaStatus(); requestAnimationFrame(frame);
if (!canvas.getContext) toast('このブラウザでは描画機能を使えません。');
