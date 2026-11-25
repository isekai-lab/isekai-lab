# Game 2 VFX

`src/vfx-presets.ts` is the single editable source for battle effects. Every
named action (`attack`, `dew`, `spark`, `wind`, `guard`, `hit`, and `counter`)
has a responsive percentage position and a short one-shot tsParticles emitter.
`SPARK_COMBO_VFX` is emitted only for wet + spark.

The runtime is the vendored official tsParticles full browser bundle at
`../../common/vendor/tsparticles-4.6.0.bundle.min.js`. The full bundle is used
because emitters are absent from the slim bundle. The build script inlines it
only in `game2.html`; it makes no request at runtime. It draws a transparent
canvas above the existing Canvas2D scene, preserving the battle rules and HUD.

To tune an effect, edit only the typed data in `vfx-presets.ts`: `position` is
0–100 percent of the responsive stage, while `rate.quantity`, color, size, and
move describe the burst. Keep counts small. Reduced-motion users receive no
particle bursts. No image URL or JSON fetch is allowed: standard square
particles keep the standalone game fully offline.

## Reproduction

Install the pinned dependency, copy
`node_modules/tsparticles/tsparticles.bundle.min.js` to the vendor path above,
then run `npm run build`. Bundle SHA-256, source, and MIT license are recorded
in `../../common/vendor/README.md`.
