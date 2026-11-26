# Vendored browser dependencies

## tsParticles 4.6.0 full bundle

- File: `tsparticles-4.6.0.bundle.min.js`
- Source package: [`tsparticles@4.6.0`](https://www.npmjs.com/package/tsparticles/v/4.6.0)
- Official source: <https://github.com/tsparticles/tsparticles>
- Upstream package path: `tsparticles.bundle.min.js`
- SHA-256: `6c9b0d6912ce0a80d8d41627f85adf3c9b7200485da89be1309f3cb365746291`
- License: MIT; the complete upstream text is retained in
  `tsparticles-4.6.0.LICENSE` and is inlined into `game2.html` and
  `effect-catalog.html` with the bundle.

It was installed with `npm install --save-dev --ignore-scripts tsparticles@4.6.0`
and copied byte-for-byte from that package. `3min-rpg/scripts/build.mjs` reads
it only for `game2.html`, before the game application code. It is not included
in any other standalone game.

The companion developer tool is `@tsparticles/mcp-server@4.6.0`. Run
`npm run effects:mcp` for its stdio server. Upstream README:
<https://raw.githubusercontent.com/tsparticles/tsparticles/main/integrations/mcp-server/README.md>.
