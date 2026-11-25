export type BattleAction = 'attack' | 'dew' | 'spark' | 'wind' | 'guard';
export const ENEMIES = [
  { name: '草もちスライム', sprite: 'slime', hp: 18, damage: 4, armor: 0, intent: 'ぷるぷる体当たり' },
  { name: '夜ふかしコウモリ', sprite: 'bat', hp: 24, damage: 6, armor: 0, intent: '急降下' },
  { name: '石の番人', sprite: 'golem', hp: 34, damage: 8, armor: 4, intent: '石のこぶし' }
];
export type BattleState = { hp: number; mp: number; wave: number; enemyHp: number; wet: number; turn: number; log: string[]; ended: boolean; clear: boolean; combos: number; skills: number };
export const BATTLE_COST: Record<BattleAction, number> = { attack: 0, dew: 1, spark: 2, wind: 1, guard: 0 };
export function newBattle(): BattleState { return { hp: 32, mp: 8, wave: 0, enemyHp: ENEMIES[0].hp, wet: 0, turn: 0, log: ['水を一滴、静電気、そよ風。小さな魔法で、三体の魔物を突破しよう。'], ended: false, clear: false, combos: 0, skills: 0 }; }
export function enemyIntent(state: BattleState): { damage: number; text: string } {
  const foe = ENEMIES[state.wave]; const charged = state.turn % 3 === 2;
  return { damage: foe.damage * (charged ? 2 : 1), text: charged ? `大技：${foe.intent}` : foe.intent };
}
export function battleTurn(state: BattleState, action: BattleAction): BattleState {
  if (state.ended || !(action in BATTLE_COST) || state.mp < BATTLE_COST[action]) return state;
  const s: BattleState = { ...state, log: [], turn: state.turn + 1, mp: state.mp - BATTLE_COST[action] };
  const foe = ENEMIES[s.wave], intent = enemyIntent(state);
  let damage = 0, shield = 0;
  if (action === 'attack') { damage = Math.max(1, 6 - foe.armor); s.log.push(`木の杖で攻撃。${damage}ダメージ。`); }
  if (action === 'dew') { damage = 1; s.wet = 3; s.skills++; s.log.push('水を一滴。敵がぬれた！ 次の静電気が強くなる。'); }
  if (action === 'spark') { damage = s.wet > 0 ? 16 : 4; if (s.wet > 0) { s.combos++; s.wet = 0; } s.skills++; s.log.push(`静電気！ ${damage === 16 ? '水を伝って大きく放電！ ' : ''}${damage}ダメージ。`); }
  if (action === 'wind') { damage = 2; shield = .8; s.skills++; s.log.push('そよ風が敵の動きをそらす。2ダメージ、今回の被害を大きく軽減。'); }
  if (action === 'guard') { shield = .75; const recovered = Math.min(3, 8 - s.mp); s.mp += recovered; s.log.push(`葉の盾で身を守る。魔力が${recovered}回復した。`); }
  s.enemyHp = Math.max(0, s.enemyHp - damage);
  if (s.enemyHp === 0) {
    s.log.push(`${foe.name}を倒した！`);
    if (s.wave === ENEMIES.length - 1) { s.ended = true; s.clear = true; return s; }
    s.wave++; s.enemyHp = ENEMIES[s.wave].hp; s.wet = 0; s.turn = 0; s.hp = 32; s.mp = 8;
    s.log.push(`木陰でひと休み。体力と魔力が全回復。次は${ENEMIES[s.wave].name}。`); return s;
  }
  const received = Math.max(1, Math.round(intent.damage * (1 - shield)));
  s.hp = Math.max(0, s.hp - received); s.log.push(`${intent.text}。${received}ダメージを受けた。`);
  s.wet = Math.max(0, s.wet - 1);
  if (!s.hp) s.ended = true;
  return s;
}
