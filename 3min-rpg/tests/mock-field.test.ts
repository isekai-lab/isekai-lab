import test from 'node:test';
import assert from 'node:assert/strict';
import { adjacentPoints, fields, findPath, pointKey, walkable } from '../mock/src/field.ts';

for (const field of Object.values(fields)) {
  test(`${field.name}: start, scenery and interactions agree with the field model`, () => {
    assert.equal(walkable(field, field.start), true, 'start must be walkable');

    for (const object of field.scenery) {
      for (const offset of object.footprint) {
        const solid = { x: object.x + offset.x, y: object.y + offset.y };
        assert.equal(field.blocked.has(pointKey(solid)), true, `${object.kind} footprint must be blocked`);
        assert.equal(walkable(field, solid), false, `${object.kind} must reject a direct one-tile step`);
      }
    }

    for (const feature of field.features) {
      assert.equal(walkable(field, feature), false, `${feature.kind} tile must be solid`);
      const routes = adjacentPoints(feature)
        .map((target) => findPath(field, field.start, target))
        .filter((route): route is NonNullable<typeof route> => Boolean(route));
      assert.ok(routes.length > 0, `${feature.kind} needs a reachable interaction side`);
    }
  });

  test(`${field.name}: water is solid except for bridges and both banks connect`, () => {
    for (const id of field.water) {
      const [x, y] = id.split(',').map(Number);
      assert.equal(walkable(field, { x, y }), field.bridges.has(id), `${id} water/bridge mismatch`);
    }
    if (!field.water.size) return;
    const bridge = [...field.bridges][0].split(',').map(Number);
    const x = bridge[0], y = bridge[1];
    assert.ok(findPath(field, { x, y: y - 1 }, { x, y: y + 1 }), 'bridge must connect both banks');
  });
}
