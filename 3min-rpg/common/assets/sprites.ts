// Original hand-authored pixel sprites. CC0-1.0. Each character is one pixel.
export const PALETTE: Record<string, string> = {
  '.': '', 'o': '#283a38', 'g': '#74a86a', 'G': '#386a53', 'l': '#bdd77b',
  'w': '#fcf2d5', 's': '#edc3a1', 'h': '#77594d', 'b': '#7185b0',
  'B': '#46577c', 'y': '#e9bd64', 'r': '#ce7965', 'p': '#ae8dad', 't': '#a68361'
};
export const SPRITES: Record<string, string[]> = {
  hero: [
    '.....oooo.......','....oyyyyo......','...oyyyyyyo.....','...ohhhhho......',
    '...oswosso......','....osssso......','.....osso.......','...oGGGGGo......',
    '..oGlGGGlGo.....','..osGGGGGso.....','...oGGGGGo......','....oyyyo.......',
    '....oBBo........','...oBB.Bo.......','...ohh.hho......','...ooo.ooo......'
  ],
  slime: [
    '................','................','................','......oooo......',
    '....ooggggoo....','...ogggllgggo...','..oggggggggggo..','..ogwogggowggo..',
    '.oggggggggggggo.','.oggggooogggggo.','.oGGggggggggGGo.','..oGGGGGGGGGGo..',
    '...oooooooooo...','................','................','................'
  ],
  bat: [
    '................','.oo..........oo.','.oBo........oBo.','.oBBo..oo..oBBo.',
    '.oBBBooBBooBBBo.','..oBBBBBBBBBBo..','...oBwBBwBBBo...','....oBBBBBBo....',
    '.....oBwwBo.....','......oooo......','................','................',
    '................','................','................','................'
  ],
  golem: [
    '....ooooooo.....','...ottttttto....','...otwwtwwto....','...ottttttto....',
    '....ottttto.....','..ooottottooo...','.ottttttttttto..','.ottotttttotto..',
    '.ottotttttotto..','..ooottottooo...','....ottttto.....','....ottotto.....',
    '...otto.otto....','...otto.otto....','..otttto.tttto..','..oooooo.ooooo..'
  ],
  tree: [
    '......GGGG......','....GGgllgGG....','...GGgllllgGG...','..GGgllllllgGG..',
    '.GGgggllllgggGG.','GGgggggllgggggGG','GGggggggggggggGG','.GGggggggggggGG.',
    '..GGGggggggGGG..','....GGttttGG....','......tttt......','......thht......',
    '......thht......','.....tthhtt.....','....ttthhttt....','...tttttttttt...'
  ],
  shrine: [
    '.......yy.......','......yyyy......','.....yywwyy.....','....yyyyyyyy....',
    '...oooooooooo...','....tttttttt....','....twwwwwwt....','....twwGGwwt....',
    '....twGllGwt....','....twwGGwwt....','....twwwwwwt....','....tttttttt....',
    '...tttttttttt...','..tttttttttttt..','..oooooooooooo..','................'
  ],
  leaf: [
    '...........GGG..','........GGGllG..','......GGlllllG..','....GGlllllllG..',
    '...GllllllGllG..','..GllllllGlllG..','.GllllllGllllG..','.GlllllGllllG...',
    '.GllllGllllG....','.GlllGllllG.....','..GlGllllG......','..GGlllGG.......',
    '..GtGGG.........','..t.............','.t..............','................'
  ]
};
