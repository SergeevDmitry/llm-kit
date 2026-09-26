---
'vec-cache': patch
---

`getOrCreate` now returns every vector, hit or miss, as a typed array in the instance's `vectorEncoding`.

A miss used to come back as whatever `embed` returned, usually a full-precision `number[]`, while a hit came back as a decoded `Float32Array`. One result could mix both, `JSON.stringify` rendered one as an array and the other as an object, and a text's first call returned different numbers from its later hits. A miss is now converted to the value the cache stored: `Float32Array` by default, `Float64Array` under `vectorEncoding: 'float64'`. Set `vectorEncoding: 'float64'` to keep the full precision `embed` returned. `getMany` also converts a row written under another `vectorEncoding` to the instance's.
