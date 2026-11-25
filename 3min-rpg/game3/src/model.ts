export type Point = { x: number; y: number };
export type Mob = Point & { id: number; hp: number; kind: 'slime' | 'bat' | 'golem'; speed: number; hit: number };
export type Shot = Point & { vx: number; vy: number; life: number };
export type Gem = Point & { value: number };
export type Upgrade = 'power' | 'haste' | 'speed' | 'heal';
export type ArenaState = {
  elapsed: number; hp: number; maxHp: number; player: Point; target: Point; mobs: Mob[]; shots: Shot[]; gems: Gem[];
  kills: number; xp: number; level: number; power: number; haste: number; speed: number; invulnerable: number;
  spawnIn: number; fireIn: number; healIn: number; upgrading: boolean; ended: boolean; clear: boolean;
  seed: number; serial: number; width: number; height: number;
};
export function newArena(seed = 42): ArenaState {
  return { elapsed: 0, hp: 18, maxHp: 18, player: { x: 320, y: 220 }, target: { x: 320, y: 220 }, mobs: [], shots: [], gems: [], kills: 0, xp: 0, level: 1, power: 3, haste: .64, speed: 135, invulnerable: 0, spawnIn: .4, fireIn: 0, healIn: 0, upgrading: false, ended: false, clear: false, seed, serial: 0, width: 640, height: 420 };
}
function randomArena(s: ArenaState): number { s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0; return s.seed / 4294967296; }
export function arenaUpgrade(s: ArenaState, kind: Upgrade): void {
  if (!s.upgrading || s.ended) return;
  if (kind === 'power') s.power += 2;
  if (kind === 'haste') s.haste = Math.max(.17, s.haste * .8);
  if (kind === 'speed') s.speed = Math.min(230, s.speed + 18);
  if (kind === 'heal') s.hp = Math.min(s.maxHp, s.hp + 7);
  s.upgrading = false;
}
export function arenaStep(s: ArenaState, seconds: number): void {
  if (s.ended || s.upgrading || seconds <= 0 || !Number.isFinite(seconds)) return;
  const dt = Math.min(seconds, .05); s.elapsed = Math.min(180, s.elapsed + dt);
  if (s.elapsed >= 180) { s.clear = true; s.ended = true; return; }
  const dx = s.target.x - s.player.x, dy = s.target.y - s.player.y, distance = Math.hypot(dx, dy);
  if (distance > 2) { const travel = Math.min(distance, s.speed * dt); s.player.x += dx / distance * travel; s.player.y += dy / distance * travel; }
  s.player.x = Math.max(18, Math.min(s.width - 18, s.player.x)); s.player.y = Math.max(30, Math.min(s.height - 18, s.player.y));
  s.invulnerable = Math.max(0, s.invulnerable - dt); s.spawnIn -= dt; s.fireIn -= dt;
  if (s.spawnIn <= 0 && s.mobs.length < 100) {
    const edge = Math.floor(randomArena(s) * 4), pos = randomArena(s), late = s.elapsed > 90;
    const kind: Mob['kind'] = randomArena(s) < .24 ? 'bat' : late && randomArena(s) < .12 ? 'golem' : 'slime';
    s.mobs.push({ id: ++s.serial, x: edge === 0 ? -10 : edge === 1 ? 650 : pos * 640, y: edge === 2 ? -10 : edge === 3 ? 430 : pos * 420, hp: kind === 'golem' ? 36 : kind === 'bat' ? 4 + Math.floor(s.elapsed / 70) : 6 + Math.floor(s.elapsed / 45), speed: kind === 'bat' ? 47 : kind === 'golem' ? 19 : 27 + s.elapsed / 15, kind, hit: 0 });
    s.spawnIn = Math.max(.32, 1.25 - s.elapsed / 190);
  }
  if (s.fireIn <= 0 && s.mobs.length) {
    let closest = s.mobs[0], d = Infinity;
    for (const mob of s.mobs) { const n = Math.hypot(mob.x - s.player.x, mob.y - s.player.y); if (n < d) { d = n; closest = mob; } }
    if (d < 240) {
      const angle = Math.atan2(closest.y - s.player.y, closest.x - s.player.x);
      const count = s.level >= 6 ? 3 : s.level >= 3 ? 2 : 1;
      for (let i = 0; i < count; i++) { const a = angle + (i - (count - 1) / 2) * .15; s.shots.push({ ...s.player, vx: Math.cos(a) * 290, vy: Math.sin(a) * 290, life: .95 }); }
      s.fireIn = s.haste;
    }
  }
  for (const mob of s.mobs) {
    mob.hit = Math.max(0, mob.hit - dt);
    const mx = s.player.x - mob.x, my = s.player.y - mob.y, d = Math.hypot(mx, my) || 1;
    mob.x += mx / d * mob.speed * dt; mob.y += my / d * mob.speed * dt;
    if (d < (mob.kind === 'golem' ? 24 : 18) && !s.invulnerable) { s.hp = Math.max(0, s.hp - (mob.kind === 'golem' ? 3 : 2)); s.invulnerable = .9; }
  }
  for (const shot of s.shots) {
    shot.x += shot.vx * dt; shot.y += shot.vy * dt; shot.life -= dt;
    for (const mob of s.mobs) if (mob.hp > 0 && shot.life > 0 && Math.hypot(shot.x - mob.x, shot.y - mob.y) < (mob.kind === 'golem' ? 23 : 17)) { mob.hp -= s.power; mob.hit = .12; shot.life = 0; break; }
  }
  s.shots = s.shots.filter(shot => shot.life > 0);
  for (const mob of s.mobs) if (mob.hp <= 0) { s.kills++; s.gems.push({ x: mob.x, y: mob.y, value: mob.kind === 'golem' ? 5 : 1 }); }
  s.mobs = s.mobs.filter(mob => mob.hp > 0);
  for (const gem of s.gems) {
    const gx = s.player.x - gem.x, gy = s.player.y - gem.y, d = Math.hypot(gx, gy);
    if (d < 70 && d > 1) { gem.x += gx / d * 150 * dt; gem.y += gy / d * 150 * dt; }
    if (d < 18) { s.xp += gem.value; gem.value = 0; }
  }
  s.gems = s.gems.filter(gem => gem.value > 0).slice(-200);
  if (s.hp <= 0) { s.ended = true; return; }
  const threshold = 4 + s.level * 2;
  if (s.xp >= threshold) { s.xp -= threshold; s.level++; s.upgrading = true; }
}
