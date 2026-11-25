import { BATTLE_COST } from './model.ts';
import type { BattleAction, BattleState } from './model.ts';

export type BattleFrame = { state: BattleState; effect: BattleAction | 'hit' | 'counter'; damage: number; recovery: number };

// UI-only snapshots: the model remains atomic, while the scene shows a turn in order.
export function battleTurnFrames(before: BattleState, after: BattleState, action: BattleAction): { action: BattleFrame; hit: BattleFrame; counter?: BattleFrame } {
  const damage = Math.max(0, before.enemyHp - (after.wave === before.wave ? after.enemyHp : 0));
  const actionMp = action === 'guard' ? Math.min(8, before.mp + 3) : before.mp - BATTLE_COST[action];
  const recovery = action === 'guard' ? actionMp - before.mp : 0;
  const actionState: BattleState = { ...before, mp: actionMp, log: after.log.slice(0, 1) };
  const defeated = after.wave !== before.wave || after.clear;
  const hitState: BattleState = defeated
    ? { ...before, mp: actionMp, enemyHp: 0, wet: after.wet, log: after.log.slice(0, 2), ended: false, clear: false }
    : { ...after, hp: before.hp, mp: actionMp, turn: before.turn, log: after.log.slice(0, 1), ended: false };
  const counter = defeated ? undefined : { state: { ...after, ended: false, clear: false }, effect: 'counter' as const, damage, recovery };
  return { action: { state: actionState, effect: action, damage, recovery }, hit: { state: hitState, effect: 'hit', damage, recovery }, counter };
}
