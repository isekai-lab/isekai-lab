import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { PALETTE, SPRITES } from '../common/assets/sprites.ts';

test('shared assets use a complete palette and small, reusable pixel grids', () => {
  for (const [name, rows] of Object.entries(SPRITES)) {
    assert.equal(rows.length, 16, name);
    for (const row of rows) {
      assert.equal(row.length, 16, `${name}: ${row}`);
      for (const pixel of row) assert.ok(pixel in PALETTE, `${name}: missing ${pixel}`);
    }
  }
});
for (const name of ['index', 'game1', 'game2', 'game3']) {
  test(`${name}: distribution is standalone, has no network dependencies and parses`, () => {
    const html = readFileSync(new URL(`../dist/${name}.html`, import.meta.url), 'utf8');
    assert.ok(html.includes('viewport')); assert.ok(html.includes('connect-src \'none\''));
    assert.ok(!/<script\b[^>]*\bsrc\s*=|<link\b[^>]*\bhref\s*=/i.test(html));
    assert.ok(!html.includes('/Users/ando'));
    // The game application is network-free. The vendored engine includes an
    // unused generic URL-loader implementation, so inspect after its marker.
    const marker = '/* application:start */';
    if (name === 'game2') assert.ok(html.includes(marker));
    const application = name === 'game2' ? html.slice(html.indexOf(marker) + marker.length) : html;
    assert.ok(!application.includes('fetch('));
    const source = html.match(/<script>([\s\S]*?)<\/script>/)?.[1]; assert.ok(source);
    assert.doesNotThrow(() => new vm.Script(source));
  });
}
