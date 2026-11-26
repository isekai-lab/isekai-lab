export type Point = { x: number; y: number };
export type PlaceId = 'village' | 'lab' | 'frontier';
export type Feature = { kind: 'npc' | 'sign' | 'chest'; x: number; y: number; text: string };
export type SceneryKind = 'house' | 'tower' | 'tree' | 'fence' | 'lab' | 'crystal' | 'barricade' | 'ruin';
export type Scenery = { kind: SceneryKind; x: number; y: number; footprint: Point[]; variant?: number };
export type Field = {
  id: PlaceId; name: string; width: number; height: number; blocked: Set<string>;
  water: Set<string>; bridges: Set<string>; roads: Set<string>; features: Feature[];
  scenery: Scenery[]; start: Point;
};

export const pointKey = (point: Point): string => `${point.x},${point.y}`;
const cells = (items: Point[]): Set<string> => new Set(items.map(pointKey));
const line = (x0: number, x1: number, y0: number, y1: number): Point[] => {
  const result: Point[] = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) result.push({ x, y });
  }
  return result;
};
const footprint = (width: number, depth: number): Point[] => line(0, width - 1, 1 - depth, 0);
const item = (kind: SceneryKind, x: number, y: number, shape: Point[], variant = 0): Scenery => ({
  kind,
  x,
  y,
  footprint: shape,
  variant,
});
const fieldTree = (x: number, y: number, variant = 0): Scenery => item('tree', x, y, [{ x: 0, y: 0 }], variant);
const fence = (x: number, y: number): Scenery => item('fence', x, y, [{ x: 0, y: 0 }]);

function makeField(
  id: PlaceId,
  name: string,
  start: Point,
  scenery: Scenery[],
  features: Feature[],
  waterPoints: Point[] = [],
  bridgePoints: Point[] = [],
  roadPoints: Point[] = [],
): Field {
  const solid = scenery.flatMap((object) => object.footprint.map((cell) => ({
    x: object.x + cell.x,
    y: object.y + cell.y,
  })));
  solid.push(...features.map(({ x, y }) => ({ x, y })));
  return {
    id,
    name,
    width: 24,
    height: 20,
    start,
    scenery,
    features,
    blocked: cells(solid),
    water: cells(waterPoints),
    bridges: cells(bridgePoints),
    roads: cells(roadPoints),
  };
}

const villageScenery: Scenery[] = [
  item('house', 7, 9, footprint(3, 2), 0), item('house', 13, 9, footprint(3, 2), 1), item('tower', 10, 7, footprint(2, 2)),
  ...[3, 4, 5, 6, 7, 8, 9, 14, 15, 16, 17, 18, 19, 20].map((x, index) => fieldTree(x, 4, index % 3)),
  ...[3, 4, 5, 18, 19, 20].map((x, index) => fieldTree(x, 7 + (index % 2), index % 3)),
  ...[2, 3, 20, 21].flatMap((x) => [11, 14, 17].map((y, index) => fieldTree(x, y, index))),
  ...[6, 7, 8, 9, 13, 14, 15, 16].map((x) => fence(x, 11)),
  fieldTree(5, 15, 1), fieldTree(18, 15, 2), fieldTree(7, 18), fieldTree(16, 18, 1),
];
const villageFeatures: Feature[] = [
  { kind: 'npc', x: 12, y: 14, text: '村人「北の森では、鐘の音を聞くと道に迷わないよ。」' },
  { kind: 'sign', x: 10, y: 14, text: '木の標識：北は こもれびの森 ／ 東は研究所' },
  { kind: 'chest', x: 15, y: 16, text: '古い宝箱。中には、つやのある小さな葉があった。' },
];
const labScenery: Scenery[] = [
  item('lab', 8, 8, footprint(7, 3)), item('crystal', 5, 12, footprint(1, 1)), item('crystal', 18, 11, footprint(1, 1), 1),
  ...[3, 4, 5, 18, 19, 20].map((x, index) => fieldTree(x, 5 + (index % 2), index % 3)),
  ...[3, 20].flatMap((x) => [9, 13, 17].map((y, index) => fieldTree(x, y, index))),
  ...[7, 8, 9, 13, 14, 15].map((x) => fence(x, 11)),
];
const labFeatures: Feature[] = [
  { kind: 'npc', x: 14, y: 14, text: '研究員「ルーンの光は、雨の日ほどよく見えるんです。」' },
  { kind: 'sign', x: 11, y: 12, text: '研究棟：小さな魔法を、組み合わせて調べよう。' },
  { kind: 'chest', x: 17, y: 16, text: '試料箱。中には淡い紫の結晶片がある。' },
];
const frontierScenery: Scenery[] = [
  item('barricade', 8, 11, footprint(3, 2)), item('barricade', 13, 11, footprint(3, 2)), item('ruin', 10, 6, footprint(3, 2)),
  ...[2, 3, 4, 5, 6, 7, 16, 17, 18, 19, 20, 21].map((x, index) => fieldTree(x, 3 + (index % 2), index % 3)),
  ...[2, 21].flatMap((x) => [7, 11, 15, 18].map((y, index) => fieldTree(x, y, index))), ...[6, 7, 16, 17].map((x) => fence(x, 14)),
];
const frontierFeatures: Feature[] = [
  { kind: 'npc', x: 9, y: 14, text: '見張り「遺跡の向こうに、森の精霊が集まっている。」' },
  { kind: 'sign', x: 12, y: 14, text: '防衛線。橋の先は警戒区域です。' },
  { kind: 'chest', x: 17, y: 16, text: '補給箱。風よけの葉の盾が入っていた。' },
];

export const fields: Record<PlaceId, Field> = {
  village: makeField('village', '鐘の村', { x: 11, y: 16 }, villageScenery, villageFeatures, line(0, 23, 12, 12), line(10, 11, 12, 12), [...line(10, 12, 5, 19), ...line(6, 17, 10, 10), ...line(6, 17, 14, 16)]),
  lab: makeField('lab', '魔法研究所', { x: 11, y: 16 }, labScenery, labFeatures, [], [], [...line(10, 12, 8, 19), ...line(5, 18, 13, 16)]),
  frontier: makeField('frontier', 'こもれび防衛線', { x: 11, y: 16 }, frontierScenery, frontierFeatures, line(0, 23, 8, 8), line(10, 11, 8, 8), [...line(10, 12, 4, 19), ...line(6, 17, 14, 16)]),
};

export function walkable(field: Field, point: Point): boolean {
  const id = pointKey(point);
  return point.x >= 0 && point.y >= 0 && point.x < field.width && point.y < field.height && !field.blocked.has(id) && (!field.water.has(id) || field.bridges.has(id));
}
const steps: Point[] = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
export function findPath(field: Field, start: Point, goal: Point): Point[] | undefined {
  if (!walkable(field, start) || !walkable(field, goal)) return undefined;
  const queue = [start];
  const seen = new Set([pointKey(start)]);
  const previous = new Map<string, Point>();
  for (let index = 0; index < queue.length; index++) {
    const here = queue[index];
    if (here.x === goal.x && here.y === goal.y) {
      const path: Point[] = [];
      for (
        let at: Point | undefined = here;
        at && pointKey(at) !== pointKey(start);
        at = previous.get(pointKey(at))
      ) {
        path.unshift(at);
      }
      return path;
    }
    for (const step of steps) {
      const next = { x: here.x + step.x, y: here.y + step.y };
      const id = pointKey(next);
      if (walkable(field, next) && !seen.has(id)) {
        seen.add(id);
        previous.set(id, here);
        queue.push(next);
      }
    }
  }
  return undefined;
}
export function adjacentPoints(point: Point): Point[] {
  return steps.map((step) => ({ x: point.x + step.x, y: point.y + step.y }));
}
export function nearby(field: Field, point: Point): Feature | undefined {
  return field.features.find((feature) => Math.abs(feature.x - point.x) + Math.abs(feature.y - point.y) === 1);
}
