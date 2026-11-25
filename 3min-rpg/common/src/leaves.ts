export type Leaf = {
  id: string; game: string; title: string; note: string;
  outcome: 'clear' | 'memory' | 'handmade'; created: string;
};
export type Archive = { version: 1; leaves: Leaf[]; discoveries: string[] };
export const STORE_KEY = 'tensei-lab.archive.v1';
export const emptyArchive = (): Archive => ({ version: 1, leaves: [], discoveries: [] });
export function validateArchive(value: unknown): Archive {
  if (!value || typeof value !== 'object') throw new Error('記憶の葉のファイルではありません。');
  const v = value as Record<string, unknown>;
  if (v.version !== 1 || !Array.isArray(v.leaves) || !Array.isArray(v.discoveries)) throw new Error('対応していない形式です。');
  if (v.leaves.length > 1000 || v.discoveries.length > 100) throw new Error('葉の数が多すぎます。');
  const seen = new Set<string>();
  const leaves = v.leaves.map((x: unknown) => {
    if (!x || typeof x !== 'object') throw new Error('葉のデータが壊れています。');
    const l = x as Record<string, unknown>;
    for (const key of ['id', 'game', 'title', 'note', 'created']) {
      if (typeof l[key] !== 'string' || (l[key] as string).length > (key === 'note' ? 500 : 120)) throw new Error('葉の文章が長すぎるか、不正です。');
    }
    if (!l.id || !l.title || seen.has(l.id as string) || !['clear', 'memory', 'handmade'].includes(String(l.outcome)) || !Number.isFinite(Date.parse(l.created as string))) throw new Error('葉の識別情報が不正です。');
    seen.add(l.id as string);
    return { id: l.id, game: l.game, title: l.title, note: l.note, outcome: l.outcome, created: l.created } as Leaf;
  });
  if (!v.discoveries.every((x: unknown) => typeof x === 'string' && x.length <= 80)) throw new Error('記憶の形式が不正です。');
  return { version: 1, leaves, discoveries: [...new Set(v.discoveries as string[])] };
}
export function mergeArchives(a: Archive, b: Archive): Archive {
  const unique = new Map(a.leaves.map(l => [l.id, l]));
  for (const leaf of b.leaves) if (!unique.has(leaf.id)) unique.set(leaf.id, leaf);
  return { version: 1, leaves: [...unique.values()].slice(-1000), discoveries: [...new Set([...a.discoveries, ...b.discoveries])].slice(0, 100) };
}
export function makeLeaf(game: string, title: string, note: string, outcome: Leaf['outcome']): Leaf {
  return { id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`, game, title: title.slice(0, 40), note: note.slice(0, 280), outcome, created: new Date().toISOString() };
}
