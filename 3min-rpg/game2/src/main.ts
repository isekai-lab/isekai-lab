import { $, recordLeaf, shell } from '../../common/src/ui.ts';
import { vignette } from '../../common/src/pixel.ts';
import { battleTurn, BATTLE_COST, ENEMIES, enemyIntent, newBattle } from './model.ts';
import type { BattleAction, BattleState } from './model.ts';
import { battleTurnFrames } from './battle-phases.ts';
import { BattleVfx } from './vfx.ts';

let battle = newBattle();
let saved = false;
let locked = false;
shell('ハズレスキル研究所', '水を一滴、静電気、そよ風。小さな力も、組み合わせれば。', '<section class="panel"><div class="battle-stage"><canvas id="scene" class="scene" width="640" height="288" aria-label="冒険者と魔物が向かい合う森の戦闘"></canvas><div id="battle-particles" class="battle-particles" aria-hidden="true"></div><div id="battle-vitals" class="battle-vitals" aria-live="polite"></div><div id="battle-effects" class="battle-effects" aria-hidden="true"></div></div><div id="status" class="statusbar"></div><div id="battle" class="panel-body" aria-live="polite"></div></section>', 'EXPERIMENT 02 / COMMAND RPG');

const skillText: [BattleAction, string, string][] = [['attack', 'たたかう', '木の杖 · 魔力不要'], ['dew', '❧ 水を一滴', '魔力1 · ぬらす'], ['spark', 'ϟ 静電気', '魔力2 · ぬれた敵に強い'], ['wind', '〰 そよ風', '魔力1 · 攻撃をそらす'], ['guard', '◇ 葉の盾', '被害軽減 · 魔力3回復']];
type Effect = { name: BattleAction | 'counter' | 'hit'; damage?: number; recovery?: number } | undefined;
const reducedMotion = (): boolean => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (milliseconds: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, reducedMotion() ? 0 : milliseconds));
const vfx = new BattleVfx($<HTMLDivElement>('#battle-particles'));

function meter(label: string, value: number, maximum: number, kind: 'hp' | 'mp'): string {
  const width = Math.max(0, Math.min(100, value / maximum * 100));
  return `<div class="vital-meter ${kind}"><span>${label} <strong>${value} / ${maximum}</strong></span><i><b style="width:${width}%"></b></i></div>`;
}
function renderScene(view: BattleState, effect?: Effect): void {
  const foe = ENEMIES[view.wave];
  vignette($<HTMLCanvasElement>('#scene'), view.clear ? 'leaf' : foe.sprite, 1);
  $('#battle-vitals').innerHTML = `<div class="battle-vital ally ${effect?.name === 'counter' ? 'is-hit' : ''}"><b>冒険者</b>${meter('HP', view.hp, 32, 'hp')}${meter('MP', view.mp, 8, 'mp')}</div><div class="battle-vital foe ${effect?.name === 'hit' ? 'is-hit' : ''}"><b>${view.clear ? '研究完了' : foe.name}</b>${meter('HP', view.enemyHp, foe.hp, 'hp')}<div class="vital-empty">MP <strong>—</strong><small>魔力なし</small></div></div>`;
  const text = effect?.name === 'guard' ? `+${effect.recovery} MP` : effect?.name === 'counter' ? '反撃！' : effect?.name === 'hit' ? `${effect.damage ?? 0} ダメージ！` : '';
  $('#battle-effects').innerHTML = effect ? `<div class="battle-effect effect-${effect.name}"><em>${text}</em></div>` : '';
  if (effect) vfx.play(effect.name, effect.name === 'spark' && view.wet > 0);
}
function renderBattle(view = battle, effect?: Effect): void {
  const foe = ENEMIES[view.wave]; renderScene(view, effect);
  $('#status').innerHTML = `<div class="stats"><span class="hp">体力 <strong>${view.hp} / 32</strong></span><span class="mp">魔力 <strong>${view.mp} / 8</strong></span><span>遭遇 ${Math.min(view.wave + 1, 3)} / 3</span></div><span class="badge">目安3分 · 考えて選べる</span>`;
  const main = $('#battle');
  if (view.ended) {
    if (!saved) { saved = true; recordLeaf('ハズレスキル研究所', view.clear ? '一滴から始まる大魔法' : '小さな魔法の実験記録', `水と静電気の連携 ${view.combos}回。${view.clear ? '石の番人を突破した。' : `${foe.name}で倒れた。`}強い攻撃の前に、そよ風や葉の盾を。`, view.clear ? 'clear' : 'memory'); }
    main.innerHTML = `<div class="eyebrow">${view.clear ? 'EXPERIMENT SUCCESS' : 'RESEARCH CONTINUES'}</div><h2 class="story-title">${view.clear ? 'ハズレなんて、なかった。' : '失敗も、大事な研究。'}</h2><p>${view.clear ? '石の番人が道を開けた。静電気だって、水と一緒なら立派な雷魔法だ。' : '相手の次の行動を見ながら、攻撃と防御を組み合わせてみよう。'}</p><div class="message">${view.log.join('\n')}</div><div class="actions"><button class="primary" id="again">もう一度、研究する</button><a href="game3.html"><button>森の防衛線へ</button></a></div>`;
    $('#again').addEventListener('click', () => { battle = newBattle(); saved = false; renderBattle(); }); return;
  }
  const intent = enemyIntent(view);
  main.innerHTML = `<div class="enemy-card"><div><strong>${foe.name}</strong><div class="bar"><i style="width:${view.enemyHp / foe.hp * 100}%"></i></div><small>体力 ${view.enemyHp} / ${foe.hp}${view.wet ? ' · ぬれている' : ''}</small></div><div style="text-align:right">次の行動<br><strong>${intent.text}</strong><br><small>通常時 ${intent.damage}ダメージ</small></div></div><div class="skill-grid">${skillText.map(([key, label, detail]) => `<button data-skill="${key}" ${locked || view.mp < BATTLE_COST[key] ? 'disabled' : ''}>${label}<small>${detail}</small></button>`).join('')}</div><div class="battle-log">${view.log.join('\n')}</div><div class="notice">敵を倒したターンは反撃されません。3回目ごとの大技には、防御を。</div>`;
  main.querySelectorAll<HTMLButtonElement>('[data-skill]').forEach((button) => button.addEventListener('click', () => void playTurn(button.dataset.skill as BattleAction)));
}
async function playTurn(action: BattleAction): Promise<void> {
  if (locked) return;
  const before = battle, after = battleTurn(before, action); if (after === before) return;
  locked = true;
  try {
    const frames = battleTurnFrames(before, after, action);
    renderBattle(frames.action.state, { name: frames.action.effect, damage: frames.action.damage, recovery: frames.action.recovery }); await wait(440);
    renderBattle(frames.hit.state, frames.hit.damage ? { name: frames.hit.effect, damage: frames.hit.damage, recovery: frames.hit.recovery } : undefined); await wait(430);
    if (frames.counter) { renderBattle(frames.counter.state, { name: frames.counter.effect, damage: frames.counter.damage, recovery: frames.counter.recovery }); await wait(380); }
    battle = after;
  } finally { locked = false; renderBattle(); }
}
renderBattle();
