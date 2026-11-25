import { emptyArchive, makeLeaf, mergeArchives, STORE_KEY, validateArchive } from './leaves.ts';
import type { Archive, Leaf } from './leaves.ts';
import { sprite } from './pixel.ts';
export const $ = <T extends HTMLElement = HTMLElement>(selector: string): T => {
  const el = document.querySelector<T>(selector); if (!el) throw new Error(`Missing element: ${selector}`); return el;
};
export const htmlEscape = (text: string): string => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
let archive: Archive = emptyArchive();
let durable = true;
try { const raw = localStorage.getItem(STORE_KEY); if (raw) archive = validateArchive(JSON.parse(raw)); }
catch { durable = false; }
let toastTimeout = 0;
export function toast(message: string): void {
  const el = $('#toast'); el.textContent = message; el.classList.remove('hide');
  window.clearTimeout(toastTimeout); toastTimeout = window.setTimeout(() => el.classList.add('hide'), 4200);
}
function persist(): void {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(archive)); }
  catch { durable = false; toast('このブラウザでは自動保存できません。「葉を書き出す」で保存してください。'); }
  refreshArchive();
}
export function discoveries(): string[] { return [...archive.discoveries]; }
export function remember(key: string): void { if (!archive.discoveries.includes(key)) { archive.discoveries.push(key); persist(); } }
export function recordLeaf(game: string, title: string, note: string, outcome: Leaf['outcome']): Leaf {
  const leaf = makeLeaf(game, title, note, outcome); archive.leaves.push(leaf); archive.leaves = archive.leaves.slice(-1000); persist(); toast('冒険が、一枚の記憶の葉になりました。'); return leaf;
}
export function downloadFile(name: string, data: Blob): void {
  const url = URL.createObjectURL(data), link = document.createElement('a'); link.href = url; link.download = name; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}
function leafImage(leaf: Leaf): HTMLCanvasElement {
  const canvas = document.createElement('canvas'); canvas.width = 720; canvas.height = 960;
  const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#e4e9d4'; ctx.fillRect(0, 0, 720, 960);
  ctx.fillStyle = '#faf6e7'; ctx.fillRect(30, 30, 660, 900); ctx.strokeStyle = '#b7c59a'; ctx.lineWidth = 2; ctx.strokeRect(46, 46, 628, 868);
  ctx.fillStyle = '#527252'; ctx.font = '16px monospace'; ctx.fillText('TENSEI LAB / MEMORY LEAF', 80, 105);
  sprite(ctx, 'leaf', 255, 140, 13);
  ctx.fillStyle = '#304b39'; ctx.font = 'bold 31px sans-serif';
  wrapText(ctx, leaf.title, 80, 420, 550, 43, 3);
  ctx.fillStyle = '#6b775f'; ctx.font = '20px sans-serif'; wrapText(ctx, leaf.note, 80, 565, 550, 34, 8);
  ctx.fillStyle = '#718269'; ctx.font = '16px sans-serif'; ctx.fillText(leaf.game, 80, 840); ctx.fillText(new Date(leaf.created).toLocaleDateString('ja-JP'), 80, 875);
  return canvas;
}
function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, height: number, max: number): void {
  let line = '', row = 0;
  for (const char of text) {
    if (char === '\n' || ctx.measureText(line + char).width > width) {
      if (row === max - 1) { ctx.fillText(line.slice(0, -1) + '…', x, y + row * height); return; }
      ctx.fillText(line, x, y + row++ * height); line = char === '\n' ? '' : char;
    } else line += char;
  }
  ctx.fillText(line, x, y + row * height);
}
let selectedId: string | null = null;
function editLeaf(leaf?: Leaf): void {
  selectedId = leaf?.id ?? null;
  $('#leaf-dialog-title').textContent = leaf ? '記憶の葉をひらく' : '記憶の葉を作る';
  $<HTMLInputElement>('#leaf-title').value = leaf?.title ?? '';
  $<HTMLTextAreaElement>('#leaf-note').value = leaf?.note ?? '';
  $('#save-leaf').textContent = leaf ? '変更を保存する' : '葉を作る';
  $('#leaf-image').classList.toggle('hide', !leaf); $('#save-png').classList.toggle('hide', !leaf);
  if (leaf) $<HTMLImageElement>('#leaf-image').src = leafImage(leaf).toDataURL('image/png');
  $<HTMLDialogElement>('#leaf-dialog').showModal();
}
function refreshArchive(): void {
  const target = document.querySelector('#leaf-list'); if (!target) return;
  $('#leaf-count').textContent = `${archive.leaves.length} 枚`;
  target.replaceChildren();
  if (!archive.leaves.length) target.innerHTML = '<div class="empty">まだ、まっさらな枝。<br>冒険のあとに、葉が一枚残ります。</div>';
  for (const leaf of [...archive.leaves].reverse()) {
    const button = document.createElement('button'); button.className = 'leaf-item';
    button.innerHTML = `<strong>❧ ${htmlEscape(leaf.title)}</strong><span>${htmlEscape(leaf.game)} · ${leaf.outcome === 'clear' ? '冒険の記録' : leaf.outcome === 'handmade' ? '手作りの葉' : '次へつながる記憶'}</span>`;
    button.addEventListener('click', () => editLeaf(leaf)); target.append(button);
  }
  $('#storage-note').textContent = durable ? 'このブラウザに保存。端末間の持ち運びには書き出しを。' : '自動保存が使えません。葉を書き出して保管してください。';
}
export function shell(title: string, subtitle: string, body: string, number: string): void {
  document.title = `${title} | 転生魔法研究所`;
  document.body.innerHTML = `<div class="wrap"><header class="masthead"><a class="brand" href="index.html"><span class="brandmark">❧</span><span><strong>転生魔法研究所</strong><small>TENSEI LAB · SMALL ADVENTURES</small></span></a><span class="edition">木漏れ日の試作室 / 001</span></header><div class="eyebrow">${number}</div><h1>${title}</h1><p class="sub">${subtitle}</p><div class="layout" style="margin-top:24px"><main id="game-main">${body}</main><aside class="panel archive"><div class="archive-header"><h2 style="margin:0">記憶の葉</h2><span class="badge" id="leaf-count">0 枚</span></div><p class="sub">今日の冒険を、持ち帰ろう。</p><div id="leaf-list" class="leaf-list"></div><div class="archive-actions"><button class="small wide" id="new-leaf">＋ 葉を作る</button><button class="small" id="export-leaves">書き出す</button><button class="small" id="import-leaves">読み込む</button></div><input type="file" id="import-file" accept=".json,application/json" class="hide"><p id="storage-note" class="notice"></p></aside></div><footer class="footer">転生魔法研究所 — 世界樹の木陰で、次の人生を研究しています。<br>試作版 / 外部通信・広告・アカウント登録なし。画像は共通のオリジナル・ピクセルアート。</footer></div><div id="toast" role="status" aria-live="polite" class="toast hide"></div><dialog id="leaf-dialog"><h2 id="leaf-dialog-title">記憶の葉</h2><label for="leaf-title">葉の名前</label><input id="leaf-title" type="text" maxlength="40" placeholder="木漏れ日の、小さな冒険"><label for="leaf-note">残しておきたいこと</label><textarea id="leaf-note" maxlength="280" placeholder="どんな選択をして、何を覚えた？"></textarea><img id="leaf-image" class="preview-leaf hide" alt="記憶の葉のプレビュー"><div class="dialog-actions"><button id="save-leaf" class="primary">葉を作る</button><button id="save-png">画像を保存</button><button id="close-leaf">閉じる</button></div><p class="notice">記憶の葉は冒険の記念品です。死に戻りの発見は別に保存されます。</p></dialog>`;
  refreshArchive();
  $('#new-leaf').addEventListener('click', () => editLeaf());
  $('#close-leaf').addEventListener('click', () => $<HTMLDialogElement>('#leaf-dialog').close());
  $('#save-leaf').addEventListener('click', () => {
    const title = $<HTMLInputElement>('#leaf-title').value.trim(), note = $<HTMLTextAreaElement>('#leaf-note').value.trim();
    if (!title) { toast('葉の名前をつけてください。'); return; }
    const leaf = archive.leaves.find(l => l.id === selectedId);
    if (leaf) { leaf.title = title; leaf.note = note; persist(); } else recordLeaf('葉の工房', title, note, 'handmade');
    $<HTMLDialogElement>('#leaf-dialog').close();
  });
  $('#save-png').addEventListener('click', () => {
    const leaf = archive.leaves.find(l => l.id === selectedId); if (!leaf) return;
    const preview = { ...leaf, title: $<HTMLInputElement>('#leaf-title').value.trim() || leaf.title, note: $<HTMLTextAreaElement>('#leaf-note').value.trim() };
    leafImage(preview).toBlob(blob => { if (blob) downloadFile(`memory-leaf-${leaf.id}.png`, blob); else toast('画像を保存できませんでした。'); });
  });
  $('#export-leaves').addEventListener('click', () => downloadFile('tensei-lab-leaves.json', new Blob([JSON.stringify(archive, null, 2)], { type: 'application/json' })));
  $('#import-leaves').addEventListener('click', () => $<HTMLInputElement>('#import-file').click());
  $('#import-file').addEventListener('change', async () => {
    const input = $<HTMLInputElement>('#import-file'), file = input.files?.[0]; if (!file) return;
    try { if (file.size > 2_000_000) throw new Error('ファイルは2MB以下にしてください。'); const imported = validateArchive(JSON.parse(await file.text())); archive = mergeArchives(archive, imported); persist(); toast('記憶の葉と発見を読み込みました。'); }
    catch (error) { toast(error instanceof Error ? error.message : '読み込めませんでした。'); }
    finally { input.value = ''; }
  });
}
