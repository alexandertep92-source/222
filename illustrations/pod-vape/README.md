# Pod vape cutaway

An interactive isometric figure of a generic refillable pod vape, cut through the
middle: USB-C port, circuit board, 1,000 mAh pouch cell with its protection board,
airflow sensor, microcontroller, MOSFET, the cradle with magnets and sprung pins,
and the pod with its liquid, coil head (mesh in cotton) and chimney.

- `pod-vape.html` (dark) and `pod-vape-light.html` (light) are standalone pages.
  Open either in a browser.
- Hold **Draw** (or Enter) to inhale: the sensor trips, the mesh lights, and vapour
  rises up the chimney. Hover, tap or use the arrow keys to take it apart.
- The numbers are typical for this kind of device, not measured from a particular
  product: 3.8 V across 0.8 Ω (4.75 A, 18 W), about 225 °C at the coil, a 10 s
  cut-off, and roughly 245 puffs of 3 s per charge. They all come from
  `source/model.mjs`.

## Rebuilding

The figure is made with the [Anatomy](https://github.com/wheresryan22/anatomy) skill
(MIT). To rebuild it, copy `source/` into that repository as `examples/pod-vape/`
and run, with Node 20.10 or later:

```sh
node examples/pod-vape/build.mjs            # dark page
node examples/pod-vape/build.mjs --light    # light page
node examples/pod-vape/build.mjs --audit    # geometry audit
```
