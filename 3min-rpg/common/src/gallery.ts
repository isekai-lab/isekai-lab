import { $, shell } from './ui.ts';
import { vignette } from './pixel.ts';
shell('木漏れ日の、三分間。', '一枚の葉から、別の人生へ。遊び方の違う三つの、小さなRPG。', '<div class="intro"><p>今日は、どんな冒険に出かけよう。<br>失敗しても、覚えたことや選んだことは「記憶の葉」として残ります。</p></div><div class="game-grid" style="grid-template-columns:1fr">'+[
  ['01', 'game1.html', '三分間の死に戻り', '鐘の村', '二つの選択肢で、夕暮れの村を救う。次の人生に持ち越すのは、あなたの記憶。', 'slime', 'カード選択 / 目安3分'],
  ['02', 'game2.html', 'ハズレスキル研究所', '小さな魔法の実験', '水を一滴、静電気、そよ風。組み合わせと相手の行動を読んで、三体の魔物を突破。', 'golem', 'コマンド戦闘 / 目安3分'],
  ['03', 'game3.html', 'こもれび防衛線', '三分間の森の冒険', 'クリックやタッチで移動。自動で飛ぶ魔法の矢と、成長する葉で森を生き延びる。', 'bat', '移動アクション / 3分']
].map(([n, path, title, tag, description, foe, badge])=>`<a class="panel game-tile" href="${path}"><canvas class="tile-image" id="tile-${n}" data-foe="${foe}" width="640" height="288" aria-label="${tag}"></canvas><div class="panel-body"><span class="number">EXPERIMENT ${n}</span><h2>${title}</h2><span class="badge">${badge}</span><p>${description}</p><span style="font-size:12px;color:var(--green)">冒険に出かける →</span></div></a>`).join('')+'</div>', 'THREE SMALL ADVENTURES / PROTOTYPE COLLECTION');
document.querySelectorAll<HTMLCanvasElement>('.tile-image').forEach(canvas => vignette(canvas, canvas.dataset.foe, 0));
$('#game-main').classList.add('gallery-main');
