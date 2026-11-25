export type StoryState = { node: string; hp: number; bag: string[]; known: string[]; steps: number; ended: boolean; clear: boolean; log: string; title: string };
export type StoryChoice = { label: string; hint: string; next: string; item?: string; damage?: number; learn?: string; needs?: string; heal?: number; end?: string; clear?: boolean };
export type StoryNode = { title: string; text: string; choices: StoryChoice[] };
export const STORY: Record<string, StoryNode> = {
  start: { title: '夕暮れまで、あと少し。', text: '鐘が鳴ると、村は深い眠りに落ちる。あなたもまた、この森で目を覚ました。世界樹の下へ続く道を、もう一度。', choices: [
    { label: '薬草小屋へ寄る', hint: '旅支度を整える', next: 'hut' },
    { label: '古い図書庫へ寄る', hint: '鐘について調べる', next: 'library' }
  ] },
  hut: { title: '薬草師の忘れもの', text: '誰もいない小屋に、水筒と赤い油の小瓶。机には「夜の森には、灯りを」と書かれている。持っていけるのはひとつだけ。', choices: [
    { label: '油の小瓶をもらう', hint: '火を灯すのに使えそう', next: 'pond', item: '油' },
    { label: '水筒をもらう', hint: '飲めば、少し元気になれる', next: 'pond', item: '水筒' }
  ] },
  library: { title: '余白の書き込み', text: '「あの鐘は、音で呪う。布で包めば、音は消える」古い本に挟まれていたのは、色あせた布だった。', choices: [
    { label: '布を持っていく', hint: '鐘を包むための布', next: 'pond', item: '布', learn: '鐘は布で包むと止まる' },
    { label: '灯りの作り方を調べる', hint: '油と枝で、たいまつを作れる', next: 'pond', item: '油', learn: '油と枝で灯りを作れる' }
  ] },
  pond: { title: '透きとおった泉', text: '歩き疲れたころ、青く光る泉に着いた。水面はきれいなのに、虫の声ひとつ聞こえない。', choices: [
    { label: '泉の水を飲む', hint: 'ひと休みしてから進む', next: 'bridge', damage: 3, learn: '青い泉の水には毒がある' },
    { label: '水には触れず進む', hint: '静かすぎるのが気になる', next: 'bridge' }
  ] },
  bridge: { title: '古い吊り橋', text: '谷にかかった吊り橋。遠くの鐘が、風に揺れている。足元の板はところどころ腐っていた。', choices: [
    { label: '急いで橋を渡る', hint: '間に合うだろうか', next: 'traveler', damage: 3, learn: '吊り橋の板は腐っている' },
    { label: '下の浅瀬を渡る', hint: '遠回りでも、足場は確か', next: 'traveler' }
  ] },
  traveler: { title: '眠りかけた旅人', text: '木陰で旅人がうとうとしている。「鐘の下は影が深い。灯りがあれば……」あなたを見ると、かばんを差し出した。', choices: [
    { label: '包帯を分けてもらう', hint: '幅広い布は、何かに巻けそう', next: 'branches', item: '布', learn: '鐘は布で包むと止まる' },
    { label: '傷薬を分けてもらう', hint: '体力を2回復する', next: 'branches', heal: 2 }
  ] },
  branches: { title: '落ち枝と、最後の陽射し', text: '道端には乾いた枝。村はすぐそこだ。木々の影が、ゆっくりと道を覆い始めている。', choices: [
    { label: '油でたいまつを作る', hint: '油の小瓶が必要', next: 'shadow', needs: '油', item: '灯り', learn: '油と枝で灯りを作れる' },
    { label: 'そのまま村へ向かう', hint: '暗い道に踏み込む', next: 'shadow' }
  ] },
  shadow: { title: '鐘楼を守る影', text: '村の入口で、黒い影が道を塞ぐ。向こうには鐘楼。影は、あなたが持つものをじっと見ている。', choices: [
    { label: '灯りをかざして進む', hint: 'たいまつが影を遠ざける', next: 'bell', needs: '灯り' },
    { label: '影の隙間を駆け抜ける', hint: '体力を3失う', next: 'bell', damage: 3, learn: '鐘楼の影は灯りを嫌う' }
  ] },
  bell: { title: '最後のひと振り', text: '鐘が、まさに鳴ろうとしている。眠ってしまった村人たち。今度こそ、ここで終わらせよう。', choices: [
    { label: '鐘を布で包む', hint: '音を止めれば、村は目を覚ます', next: '', needs: '布', end: '鐘の鳴らない夕暮れ', clear: true },
    { label: '鐘を力いっぱい叩く', hint: '鳴らして村に知らせる', next: '', end: '深い眠りの記憶', learn: '鐘は布で包むと止まる' }
  ] }
};
export function newStory(known: string[] = []): StoryState { return { node: 'start', hp: 5, bag: [], known: [...known], steps: 0, ended: false, clear: false, log: '', title: '' }; }
export function chooseStory(state: StoryState, index: number): StoryState {
  if (state.ended) return state;
  const choice = STORY[state.node]?.choices[index];
  if (!choice || choice.needs && !state.bag.includes(choice.needs)) return state;
  const next: StoryState = { ...state, bag: [...state.bag], known: [...state.known], steps: state.steps + 1, node: choice.next, log: '' };
  if (choice.item && !next.bag.includes(choice.item)) next.bag.push(choice.item);
  if (choice.learn && !next.known.includes(choice.learn)) { next.known.push(choice.learn); next.log = `覚えたこと：${choice.learn}`; }
  next.hp = Math.min(5, next.hp + (choice.heal ?? 0) - (choice.damage ?? 0));
  if (next.hp <= 0) { next.hp = 0; next.ended = true; next.title = state.node === 'pond' ? '青い泉の記憶' : state.node === 'bridge' ? '壊れた橋の記憶' : '影に触れた記憶'; }
  else if (choice.end) { next.ended = true; next.clear = choice.clear ?? false; next.title = choice.end; }
  return next;
}
