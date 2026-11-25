// Original CC0 pixel originals. One source pixel is four canvas pixels.
// Paint into character grids first: no smooth paths or rescaled vector primitives.
type Put = (x: number, y: number, colour: string) => void;
function art(width: number, height: number, paint: (put: Put) => void): string[] {
    const rows = Array.from({ length: height }, () => Array<string>(width).fill('.'));
    paint((x, y, colour) => { if (x >= 0 && x < width && y >= 0 && y < height)
        rows[y][x] = colour; });
    return rows.map(row => row.join(''));
}
function block(put: Put, x: number, y: number, w: number, h: number, colour: string): void {
    for (let yy = y; yy < y + h; yy++)
        for (let xx = x; xx < x + w; xx++)
            put(xx, yy, colour);
}
function windowPane(put: Put, x: number, y: number): void {
    block(put, x, y, 7, 7, 'o');
    block(put, x + 1, y + 1, 5, 5, 'y');
    block(put, x + 2, y + 1, 2, 2, 'w');
    block(put, x + 3, y + 1, 1, 5, 'h');
    block(put, x + 1, y + 3, 5, 1, 'h');
    block(put, x - 1, y + 7, 9, 1, 'h');
}
function roof(put: Put, width: number, rows: number, main: string): void {
    for (let y = 0; y < rows; y++) {
        const inset = rows - y;
        for (let x = inset; x < width - inset; x++) {
            put(x, y, x === inset || x === width - inset - 1 ? 'o' : main);
            if (y > 1 && y % 3 === 0 && (x + (y % 2) * 2) % 7 < 5 && x > inset + 1 && x < width - inset - 2)
                put(x, y, 'h');
        }
    }
    block(put, 0, rows - 1, width, 1, 'o');
}
const butterfly = (folded: boolean): string[] => art(12, 12, put => {
    const wing = folded ? ['....', '..oo', '.oyo', '.owo', '.oyo', '..po', '..oo', '....'] : ['.oo.', 'oyyo', 'owyo', 'oyyo', '.oyo', '.opo', '..oo', '....'];
    wing.forEach((row, y) => [...row].forEach((colour, x) => {
        if (colour === '.')
            return;
        put(x, y + 2, colour);
        put(9 - x, y + 2, colour === 'y' ? 'p' : colour);
    }));
    block(put, 4, 3, 2, 7, 'o');
    put(4, 3, 'w');
    put(3, 0, 'o');
    put(6, 0, 'o');
    put(4, 1, 'o');
    put(5, 1, 'o');
    put(4, 10, 'o');
});
export const GAME_SPRITES: Record<string, string[]> = {
    hutLarge: art(40, 32, put => {
        block(put, 2, 10, 36, 19, 'o');
        block(put, 3, 11, 34, 17, 't');
        block(put, 34, 11, 3, 17, 'h');
        for (let y = 12; y < 28; y += 4)
            block(put, 3, y, 34, 1, 'h');
        roof(put, 40, 11, 'r');
        windowPane(put, 6, 15);
        windowPane(put, 27, 15);
        block(put, 17, 16, 7, 12, 'o');
        block(put, 18, 17, 5, 11, 'h');
        block(put, 18, 18, 1, 9, 't');
        put(22, 23, 'y');
        block(put, 2, 29, 36, 2, 'B');
        block(put, 3, 29, 34, 1, 'b');
        block(put, 15, 30, 11, 2, 'h');
        block(put, 14, 31, 13, 1, 'o');
    }),
    libraryLarge: art(44, 32, put => {
        block(put, 3, 8, 38, 21, 'o');
        block(put, 4, 9, 36, 19, 'b');
        block(put, 37, 9, 3, 19, 'B');
        for (let y = 13; y < 28; y += 5) {
            block(put, 4, y, 36, 1, 'B');
            for (let x = 6 + y % 3; x < 40; x += 8)
                put(x, y - 2, 'B');
        }
        roof(put, 44, 9, 'B');
        for (const x of [7, 28]) {
            block(put, x, 13, 10, 12, 'o');
            block(put, x + 1, 14, 8, 10, 'h');
            for (let y = 14; y < 24; y += 5)
                for (let i = 0; i < 4; i++) {
                    block(put, x + 1 + i * 2, y, 1, 3, ['y', 'r', 'g', 'p'][i]);
                    put(x + 1 + i * 2, y + 1, 'w');
                }
        }
        block(put, 19, 17, 7, 12, 'o');
        block(put, 20, 18, 5, 10, 'h');
        block(put, 21, 19, 3, 4, 'p');
        put(24, 25, 'y');
        block(put, 2, 29, 40, 2, 'B');
        block(put, 3, 29, 38, 1, 'w');
        block(put, 17, 31, 11, 1, 'o');
    }),
    pondLarge: art(56, 24, put => {
        const insets = [19, 13, 9, 6, 4, 3, 2, 1, 1, 0, 0, 0, 0, 0, 1, 1, 2, 3, 4, 6, 9, 13, 19, 24];
        for (let y = 0; y < 24; y++)
            for (let x = insets[y]; x < 56 - insets[y]; x++) {
                const bank = y < 3 || y > 19 || x < insets[y] + 3 || x >= 53 - insets[y];
                put(x, y, bank ? ((x + y * 2) % 5 < 2 ? 't' : 'h') : y < 7 ? 'B' : 'b');
                if (bank && (x + y) % 7 === 0)
                    put(x, y, 'w');
            }
        for (const [x, y, w] of [[12, 7, 9], [30, 11, 13], [18, 16, 11]]) {
            block(put, x, y, w, 1, 'w');
            block(put, x + 3, y + 1, w - 5, 1, 'b');
        }
        block(put, 9, 4, 3, 2, 'G');
        block(put, 46, 17, 3, 2, 'G');
    }),
    bridgeLarge: art(88, 24, put => {
        for (let x = 0; x < 88; x++) {
            const sag = Math.round(3 + Math.sin(x / 87 * Math.PI) * 5);
            put(x, sag, 'o');
            put(x, sag + 1, 't');
            if (x % 9 === 0)
                for (let y = sag + 2; y < 15; y++)
                    put(x, y, 'h');
            if (x > 2 && x < 86) {
                put(x, 15, 'o');
                put(x, 19, 'o');
                if (x % 6 < 5) {
                    block(put, x, 16, 1, 3, x % 6 === 0 ? 'h' : 't');
                    if (x % 6 === 2)
                        put(x, 16, 'w');
                }
            }
        }
        for (const x of [0, 85]) {
            block(put, x, 0, 3, 22, 'o');
            block(put, x + 1, 1, 1, 20, 't');
        }
        block(put, 35, 17, 4, 1, 'o');
        block(put, 37, 16, 1, 3, 'o');
        block(put, 59, 18, 3, 2, '.');
    }),
    stone: ['..oooo..', '.obbbbo.', 'obwwbbbo', 'obbbbbBo', '.oBBBBo.', '..oooo..'],
    traveler: ['......oooo......', '.....ohhhho.....', '.....oswoso.....', '.....osssso.....', '......oooo......', '.....oppppo.....', '....opwwpppo....', '....opopoppo....', '.....oppppo.....', '.....oBBBBo.....', '....oBBoBBo.....', '....ohhohho.....', '....ohhohho.....', '.....oo.oo......', '................', '................'],
    bag: ['..oooo..', '.otttto.', 'otoyytto', 'otttttto', 'othtthto', 'otttttto', '.oooooo.', '........'],
    branch: ['................', '...oo...........', '..otto....oo....', '...otto..otto...', '....ottotto.....', '.....otttto.....', '......ottto.....', '.......ottto....', '........ottto...', '.........ottto..', '..........otto..', '...........oo...', '................', '................', '................', '................'],
    shadow: art(20, 24, put => {
        const inset = [8, 5, 3, 2, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 2, 3, 3, 3, 2, 2, 1, 2];
        for (let y = 0; y < 24; y++)
            for (let x = inset[y]; x < 20 - inset[y]; x++)
                put(x, y, x === inset[y] || x === 19 - inset[y] || y === 23 ? 'o' : x > 12 ? 'G' : 'o');
        block(put, 4, 7, 4, 3, 'w');
        block(put, 12, 7, 4, 3, 'w');
        put(6, 9, 'p');
        put(12, 9, 'p');
        block(put, 5, 22, 2, 2, '.');
        block(put, 11, 23, 2, 1, '.');
    }),
    bellLarge: art(24, 40, put => {
        roof(put, 24, 7, 'r');
        block(put, 2, 7, 20, 3, 'o');
        block(put, 3, 8, 18, 1, 't');
        for (const x of [3, 18]) {
            block(put, x, 10, 3, 26, 'o');
            block(put, x + 1, 10, 1, 25, 't');
        }
        for (let i = 0; i < 4; i++) {
            put(6 + i, 10 + i, 'h');
            put(17 - i, 10 + i, 'h');
        }
        block(put, 11, 10, 2, 4, 'o');
        block(put, 10, 13, 4, 2, 't');
        const widths = [4, 6, 8, 8, 8, 10, 10, 10, 12, 14, 14, 12];
        widths.forEach((width, i) => {
            const left = (24 - width) / 2;
            for (let x = left; x < left + width; x++)
                put(x, 14 + i, x === left || x === left + width - 1 || i === 11 ? 'o' : x > 13 ? 't' : 'y');
            if (i > 1 && i < 8)
                put(left + 2, 14 + i, 'w');
        });
        block(put, 11, 26, 2, 3, 'h');
        block(put, 10, 29, 4, 2, 'y');
        block(put, 2, 35, 20, 3, 'o');
        block(put, 3, 35, 18, 1, 'b');
        block(put, 0, 38, 24, 2, 'B');
        block(put, 1, 38, 22, 1, 'w');
    }),
    bellCloth: art(16, 15, put => {
        for (let y = 0; y < 14; y++)
            for (let x = 0; x < 16; x++) {
                if ((y === 0 && (x < 3 || x > 12)) || (y > 11 && (x + y) % 4 === 0))
                    continue;
                put(x, y, x === 0 || x === 15 || y === 0 ? 'o' : x % 5 === 1 ? 'w' : x % 5 === 0 ? 'B' : 'p');
            }
    }),
    oil: ['..ooo...', '..owo...', '.oyyyo..', '.oywyo..', '.oyyyo..', '.ottyo..', '.ooooo..', '........'],
    bottle: ['..ooo...', '..oBo...', '.obwbo..', '.obwbo..', '.obbbo..', '.oBBBo..', '.ooooo..', '........'],
    book: ['.oooooo.', 'oyyywwyo', 'oywywwyo', 'oyyywwyo', 'oyyywwyo', '.oooooo.', '........', '........'],
    torch: ['...oo...', '..oyyo..', '.oywwyo.', '.oyywyo.', '..oyyo..', '...oo...', '...to...', '...to...', '...to...', '...to...', '...oo...', '........'],
    butterflyA: butterfly(false),
    butterflyB: butterfly(true)
};
