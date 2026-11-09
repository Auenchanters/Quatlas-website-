// Loads core.wasm and gives views on its state arrays (layouts in core.cpp).
export const PS = 20, BS = 8, MS = 12, CS = 4, HS = 5;

export async function loadCore(bytes) {
  const { instance } = await WebAssembly.instantiate(bytes, {});
  const x = instance.exports, mem = x.memory.buffer;
  const view = (ptr, n) => new Float32Array(mem, ptr, n);
  const core = {
    x,
    P: view(x.planes(), 16 * PS), B: view(x.bullets(), 1536 * BS), M: view(x.missiles(), 48 * MS),
    C: view(x.clouds(), 64 * CS), H: view(x.hits(), 256 * HS), OUT: view(x.out(), 8),
    hitList() {
      const out = [];
      for (let i = 0, n = x.hitCount(); i < n; i++) { const h = core.H.subarray(i * HS, i * HS + HS); out.push({ plane: h[0], pos: [h[1], h[2], h[3]], kind: h[4] }); }
      return out;
    },
  };
  return core;
}
