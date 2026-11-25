import { $, discoveries, htmlEscape, recordLeaf, remember, shell } from '../../common/src/ui.ts';
import { chooseStory, newStory, STORY } from './model.ts';
import { StoryScene } from './scene.ts';
let state = newStory(discoveries());
let recorded = false;
let animating = false;
let sceneNote = '周囲を見渡している';
shell('三分間の死に戻り', '鐘の村 — 選ぶだけの短い冒険。持ち帰れるのは、覚えたこと。', '<section class="panel"><canvas id="scene" class="scene story-scene" width="640" height="288" aria-label="鐘の村へ続く森の道。選択に合わせて主人公が歩く"></canvas><div id="status" class="statusbar"></div><div id="story" class="panel-body" aria-live="polite"></div></section>', 'EXPERIMENT 01 / CHOICE RPG');
const scene = new StoryScene($<HTMLCanvasElement>('#scene'), text => { sceneNote = text; renderStatus(); });
function renderStatus(): void {
  const status = document.querySelector<HTMLElement>('#status');
  if (!status) return;
  status.innerHTML = `<span class="hp">体力 <strong>${state.hp} / 5</strong></span><span>場面 ${Math.min(state.steps + 1, 8)} / 8</span><span class="scene-note" aria-live="polite">${htmlEscape(sceneNote)}</span><span class="badge">目安3分 · 制限時間なし</span>`;
}
function renderStory(): void {
  if (!animating && !state.ended) scene.setNode(state.node);
  renderStatus();
  const body = $('#story');
  if (state.ended) {
    if (!recorded) { recorded = true; recordLeaf('鐘の村', state.title, state.clear ? `灯りと布を持って村へ。${state.steps}回の選択で鐘を止めた。何度目でも、夕暮れは美しかった。` : `冒険は${state.steps}回の選択で終わった。でも、${state.known.at(-1) ?? 'また挑戦できる'}。`, state.clear ? 'clear' : 'memory'); }
    body.innerHTML = `<div class="eyebrow">${state.clear ? 'THE VILLAGE AWAKENS' : 'A MEMORY REMAINS'}</div><h2 class="story-title">${htmlEscape(state.title)}</h2><p>${state.clear ? '鐘の音が止まり、村に夕餉の匂いが戻ってきた。あなたの冒険は、一枚の葉になった。' : '気がつくと、また森の入口だった。持ち物は消えたけれど、経験したことだけは覚えている。'}</p>${memoryMarkup()}<div class="actions"><button id="again" class="primary">${state.clear ? 'もう一つの人生を試す' : '記憶を持って、もう一度'}</button><a href="game2.html"><button>スキル研究へ</button></a></div>`;
    $('#again').addEventListener('click', () => { state = newStory(discoveries()); recorded = false; sceneNote = '森の入口に戻った。覚えていることは残っている'; renderStory(); }); return;
  }
  const node = STORY[state.node];
  body.innerHTML = `<div class="track">${Array.from({ length: 8 }, (_, i) => `<i class="${i <= state.steps ? 'done' : ''}"></i>`).join('')}</div><div class="eyebrow">THE BELL VILLAGE</div><h2 class="story-title">${node.title}</h2><p>${node.text}</p>${state.log ? `<div class="message">${htmlEscape(state.log)}</div>` : ''}<div class="choices">${node.choices.map((choice, i) => `<button class="choice" data-choice="${i}" ${animating || choice.needs && !state.bag.includes(choice.needs) ? 'disabled' : ''}><b class="symbol">${i ? '◇' : '❧'}</b>${choice.label}<span>${choice.hint}</span></button>`).join('')}</div><div class="inventory">持ちもの：${state.bag.length ? state.bag.map(htmlEscape).join(' / ') : 'まだ何もない'}</div>${memoryMarkup()}`;
  body.querySelectorAll<HTMLButtonElement>('[data-choice]').forEach(button => button.addEventListener('click', () => {
    if (animating || scene.isBusy()) return;
    const index = Number(button.dataset.choice); const choice = node.choices[index];
    if (!choice || choice.needs && !state.bag.includes(choice.needs)) return;
    animating = true;
    body.querySelectorAll<HTMLButtonElement>('[data-choice]').forEach(candidate => { candidate.disabled = true; });
    scene.play({ node: state.node, choice, index }, () => {
      state = chooseStory(state, index); state.known.forEach(remember); animating = false;
      if (state.ended) scene.finishOutcome(state.clear, state.hp <= 0);
      renderStory();
    }, () => { animating = false; renderStory(); });
  }));
}
function memoryMarkup(): string { return state.known.length ? `<div class="message"><strong>覚えていること</strong><br>${state.known.map(htmlEscape).join('<br>')}</div>` : ''; }
renderStory();
