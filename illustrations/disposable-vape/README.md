# Disposable vape cutaway

An interactive isometric figure of a typical sealed disposable vape, its aluminium
tube cut through the middle. It has no circuit board and no charging port: a bottom
plug with the air inlet and an LED, an airflow switch in a rubber seat, a 550 mAh
pouch cell whose tabs are soldered to the switch, a rubber bulkhead, an air tube with
two wicking holes holding a cotton wick and a wound coil, a felt sleeve soaked with
2 ml of liquid, a top seal and a press-fitted mouthpiece.

- `disposable-vape.html` (dark) and `disposable-vape-light.html` (light) are
  standalone pages. Open either in a browser.
- Hold **Draw** (or Enter) to inhale: the switch closes, the coil lights and vapour
  rises up the tube. The readout counts down the liquid and the charge left. Hover,
  tap or use the arrow keys to take it apart.
- The numbers are typical for this kind of device, not measured from a particular
  product: 3.7 V across 1.2 Ω (3.08 A, 11.4 W), about 205 °C in the wet cotton, an
  8 s cut-off. At 11.4 W the cell's 7.3 kJ lasts about 640 s of firing and the felt
  runs dry after about 600 s, so both give out after roughly 600 one-second puffs.
  All of it comes from `source/model.mjs`.

## Rebuilding

The figure is made with the [Anatomy](https://github.com/wheresryan22/anatomy) skill
(MIT). To rebuild it, copy `source/` into that repository as
`examples/disposable-vape/` and run, with Node 20.10 or later:

```sh
node examples/disposable-vape/build.mjs            # dark page
node examples/disposable-vape/build.mjs --light    # light page
node examples/disposable-vape/build.mjs --audit    # geometry audit
```
