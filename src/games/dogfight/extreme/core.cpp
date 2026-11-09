// Dogfight Extreme's numeric core, compiled to WebAssembly (see build-wasm.mjs): flight, steering,
// guns, missile guidance, hits, the terrain and sight lines through clouds. It runs in the game's
// worker; the pilots' decisions and the wave rules stay in JavaScript.
//
// Freestanding C++: no libc or runtime, so the .wasm is small and needs no imports. State lives in
// fixed arrays of floats that JavaScript reads through Float32Array views on the module's memory.
// Axes as in logic.js: forward +Z, up +Y, right −X. Metres, seconds.

#define EXPORT(name) extern "C" __attribute__((export_name(#name)))

namespace {

constexpr int MAXP = 16, MAXB = 1536, MAXM = 48, MAXC = 64, MAXH = 256;
// Strides, in floats (mirrored in worker.js).
constexpr int PS = 20; // pos 0-2, quat 3-6 (x y z w), vel 7-9, speed 10, min 11, max 12, agility 13, hp 14, alive 15, team 16, radius 17, wreck time 18 (JS only)
constexpr int BS = 8;  // pos 0-2, vel 3-5, life 6, team 7
constexpr int MS = 12; // pos 0-2, dir 3-5, speed 6, life 7, age 8, target 9 (plane index or -1), team 10, turn 11 (rad/s)
constexpr int CS = 4;  // x y z r
constexpr int HS = 5;  // plane, x y z, kind (0 bullet, 1 missile)

float P[MAXP * PS], B[MAXB * BS], M[MAXM * MS], C[MAXC * CS], H[MAXH * HS], OUT[8];
int nHits = 0;
unsigned seed = 2463534242u;

constexpr float PI = 3.14159265358979f, BULLET_SPEED = 900.f, BULLET_LIFE = 1.6f;

inline float sqrtf_(float x) { return __builtin_sqrtf(x); }
inline float absf(float x) { return x < 0 ? -x : x; }
inline float clampf(float v, float a = -1.f, float b = 1.f) { return v < a ? a : v > b ? b : v; }
inline float rnd() { seed ^= seed << 13; seed ^= seed >> 17; seed ^= seed << 5; return (seed >> 8) * (1.f / 16777216.f); }

// sin: reduce to [-π/2, π/2], then a 9th-order Taylor polynomial, error < 1e-5.
float sinf_(float x) {
  x -= 2 * PI * __builtin_floorf((x + PI) / (2 * PI));
  if (x > PI / 2) x = PI - x; else if (x < -PI / 2) x = -PI - x;
  float x2 = x * x;
  return x * (1 - x2 / 6 * (1 - x2 / 20 * (1 - x2 / 42 * (1 - x2 / 72))));
}
inline float cosf_(float x) { return sinf_(x + PI / 2); }
// atan on [-1, 1] (Abramowitz & Stegun 4.4.49), then the quadrants: error < 1e-5 rad.
float atanUnit(float z) {
  float z2 = z * z;
  return z * (0.9998660f + z2 * (-0.3302995f + z2 * (0.1801410f + z2 * (-0.0851330f + z2 * 0.0208351f))));
}
float atan2f_(float y, float x) {
  if (x == 0 && y == 0) return 0;
  float ax = absf(x), ay = absf(y);
  float a = ax > ay ? atanUnit(ay / ax) : PI / 2 - atanUnit(ax / ay);
  if (x < 0) a = PI - a;
  return y < 0 ? -a : a;
}
inline float acosf_(float x) { x = clampf(x); return atan2f_(sqrtf_(1 - x * x), x); }

struct V { float x, y, z; };
inline V v(const float* a) { return {a[0], a[1], a[2]}; }
inline V sub(V a, V b) { return {a.x - b.x, a.y - b.y, a.z - b.z}; }
inline V add(V a, V b, float k = 1) { return {a.x + b.x * k, a.y + b.y * k, a.z + b.z * k}; }
inline float dot(V a, V b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
inline float len(V a) { return sqrtf_(dot(a, a)); }
inline V norm(V a) { float l = len(a); return l > 1e-9f ? V{a.x / l, a.y / l, a.z / l} : V{0, 0, 1}; }
inline void put(float* o, V a) { o[0] = a.x; o[1] = a.y; o[2] = a.z; }

// Rotate a vector by a quaternion (x y z w).
V rot(const float* q, V a) {
  V u{q[0], q[1], q[2]};
  float s = q[3];
  V t{2 * (u.y * a.z - u.z * a.y), 2 * (u.z * a.x - u.x * a.z), 2 * (u.x * a.y - u.y * a.x)};
  return {a.x + s * t.x + (u.y * t.z - u.z * t.y), a.y + s * t.y + (u.z * t.x - u.x * t.z), a.z + s * t.z + (u.x * t.y - u.y * t.x)};
}
// Inverse rotation (the conjugate).
V unrot(const float* q, V a) { float c[4] = {-q[0], -q[1], -q[2], q[3]}; return rot(c, a); }
// q = q · (axis, angle): a turn about one of the plane's own axes.
void turnLocal(float* q, V axis, float ang) {
  float h = ang / 2, s = sinf_(h), w = cosf_(h);
  float bx = axis.x * s, by = axis.y * s, bz = axis.z * s;
  float ax = q[0], ay = q[1], az = q[2], aw = q[3];
  q[0] = ax * w + aw * bx + ay * bz - az * by;
  q[1] = ay * w + aw * by + az * bx - ax * bz;
  q[2] = az * w + aw * bz + ax * by - ay * bx;
  q[3] = aw * w - ax * bx - ay * by - az * bz;
}
void normq(float* q) { float l = sqrtf_(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]); for (int i = 0; i < 4; i++) q[i] /= l; }

const V FWD{0, 0, 1}, UP{0, 1, 0}, RIGHT{-1, 0, 0};

// The islands, the same sines as heightAt in logic.js.
float heightAt(float x, float z) {
  float h = 220 * sinf_(x * 0.0011f + 1.3f) * cosf_(z * 0.0013f - 0.4f)
    + 120 * sinf_(x * 0.0031f - z * 0.0022f + 2.1f)
    + 45 * sinf_(x * 0.009f + 0.7f) * sinf_(z * 0.011f + 2.9f) - 60;
  return h < -20 ? -20 : h;
}

// Does the segment a→b pass within r of c?
bool segHits(V a, V b, V c, float r) {
  V ab = sub(b, a);
  float l2 = dot(ab, ab), t = l2 > 0 ? clampf(dot(sub(c, a), ab) / l2, 0, 1) : 0;
  V d = sub(add(a, ab, t), c);
  return dot(d, d) <= r * r;
}

// Where to aim so a shot at `speed` meets a target at constant velocity.
V lead(V from, V tp, V tv, float speed) {
  V o = tp;
  for (int i = 0; i < 4; i++) o = add(tp, tv, len(sub(o, from)) / speed);
  return o;
}

// Clear sight from a to b: no cloud core (80% of its radius) in between.
bool clear(V a, V b, int nc) {
  for (int i = 0; i < nc; i++) { const float* c = C + i * CS; if (segHits(a, b, v(c), c[3] * 0.8f)) return false; }
  return true;
}

void addHit(int plane, V at, int kind) {
  if (nHits >= MAXH) return;
  float* h = H + nHits++ * HS;
  h[0] = (float)plane; put(h + 1, at); h[4] = (float)kind;
}

} // namespace

EXPORT(planes) float* planes() { return P; }
EXPORT(bullets) float* bullets() { return B; }
EXPORT(missiles) float* missiles() { return M; }
EXPORT(clouds) float* clouds() { return C; }
EXPORT(hits) float* hits() { return H; }
EXPORT(out) float* out() { return OUT; }
EXPORT(hitCount) int hitCount() { return nHits; }
EXPORT(seedRandom) void seedRandom(unsigned s) { seed = s ? s : 1; }
EXPORT(ground) float ground(float x, float z) { float h = heightAt(x, z); return h < 0 ? 0 : h; }

// Arcade flight, as fly() in logic.js. Inputs −1..1, throttle 0..1.
EXPORT(fly) void fly(int i, float pitch, float roll, float yaw, float throttle, float dt) {
  float* p = P + i * PS; float* q = p + 3;
  float ag = p[13];
  turnLocal(q, RIGHT, clampf(pitch) * 1.5f * ag * dt);
  turnLocal(q, FWD, clampf(roll) * 3.2f * ag * dt);
  turnLocal(q, UP, -clampf(yaw) * 0.55f * ag * dt);
  normq(q);
  V f = rot(q, FWD);
  float target = p[11] + clampf(throttle, 0, 1) * (p[12] - p[11]) - f.y * 40;
  float k = dt * 0.8f; p[10] += (target - p[10]) * (k > 1 ? 1 : k);
  p[10] = clampf(p[10], p[11] * 0.8f, p[12] * 1.2f);
  put(p + 7, {f.x * p[10], f.y * p[10], f.z * p[10]});
  put(p, add(v(p), v(p + 7), dt));
}

// Stick inputs that turn plane i toward a world direction (as steerToward in logic.js); OUT[0..2] = pitch, roll, yaw.
EXPORT(steer) void steer(int i, float dx, float dy, float dz) {
  const float* q = P + i * PS + 3;
  V l = unrot(q, norm({dx, dy, dz}));
  float off = acosf_(l.z), bank = atan2f_(-l.x, l.y);
  float level = clampf(rot(q, RIGHT).y * 2);
  float roll = off > 0.25f ? clampf(bank * 1.6f) : level * (1 - off / 0.25f) + clampf(bank * 1.6f) * (off / 0.25f);
  OUT[0] = clampf(l.y * 3 + (off > 1.2f ? 0.8f : 0)); OUT[1] = roll; OUT[2] = clampf(-l.x * 2.5f);
}

// Lead point for a shooter at plane i on plane j; OUT[0..2].
EXPORT(leadOn) void leadOn(int i, int j, float speed) { put(OUT, lead(v(P + i * PS), v(P + j * PS), v(P + j * PS + 7), speed)); }

// Clear sight between planes i and j (1) or a cloud in the way (0).
EXPORT(sight) int sight(int i, int j, int nc) { return clear(v(P + i * PS), v(P + j * PS), nc) ? 1 : 0; }
// Index of the cloud containing plane i (its inner 90%), or −1.
EXPORT(cloudAt) int cloudAt(int i, int nc) {
  V p = v(P + i * PS);
  for (int k = 0; k < nc; k++) { const float* c = C + k * CS; V d = sub(p, v(c)); if (dot(d, d) < c[3] * c[3] * 0.81f) return k; }
  return -1;
}

// Plane i fires; returns the new bullet count.
EXPORT(fire) int fire(int i, float spread, int n) {
  if (n >= MAXB) return n;
  const float* p = P + i * PS;
  V d = rot(p + 3, FWD);
  if (spread > 0) d = norm({d.x + (rnd() - 0.5f) * spread, d.y + (rnd() - 0.5f) * spread, d.z + (rnd() - 0.5f) * spread});
  float* b = B + n * BS;
  put(b, add(v(p), d, 12)); put(b + 3, add(v(p + 7), d, BULLET_SPEED)); b[6] = BULLET_LIFE; b[7] = p[16];
  return n + 1;
}

// Moves every bullet, records hits (bullets are spent on a hit), drops dead ones; returns the new count.
// Hits are cleared at the start of each step: call stepBullets before stepMissiles.
EXPORT(stepBullets) int stepBullets(int n, int np, float dt) {
  nHits = 0;
  int w = 0;
  for (int k = 0; k < n; k++) {
    float* b = B + k * BS;
    V a = v(b), e = add(a, v(b + 3), dt);
    b[6] -= dt;
    bool spent = b[6] <= 0 || e.y < 0;
    for (int i = 0; i < np && !spent; i++) {
      const float* p = P + i * PS;
      if (p[15] < 0.5f || p[16] == b[7]) continue;
      if (segHits(a, e, v(p), p[17])) { addHit(i, e, 0); spent = true; }
    }
    if (spent) continue;
    put(b, e);
    if (w != k) for (int j = 0; j < BS; j++) B[w * BS + j] = b[j];
    w++;
  }
  return w;
}

// Launches a missile from plane i at plane target (−1: none); returns the new missile count.
EXPORT(launch) int launch(int i, int target, float turn, int n) {
  if (n >= MAXM) return n;
  const float* p = P + i * PS;
  float* m = M + n * MS;
  put(m, add(v(p), rot(p + 3, UP), -3)); put(m + 3, rot(p + 3, FWD));
  m[6] = p[10] + 60; m[7] = 7; m[8] = 0; m[9] = (float)target; m[10] = p[16]; m[11] = turn;
  return n + 1;
}

// Guides and moves missiles. A target hidden in cloud is lost for good: the missile flies on straight.
// Hits go on the hit list (kind 1); spent missiles are dropped. Returns the new count.
EXPORT(stepMissiles) int stepMissiles(int n, int np, int nc, float dt) {
  int w = 0;
  for (int k = 0; k < n; k++) {
    float* m = M + k * MS;
    m[8] += dt; m[7] -= dt;
    m[6] = m[6] + 260 * dt > 420 ? 420 : m[6] + 260 * dt;
    int t = (int)m[9];
    const float* tp = t >= 0 && t < np ? P + t * PS : nullptr;
    if (tp && tp[15] < 0.5f) { m[9] = -1; tp = nullptr; }
    if (tp && !clear(v(m), v(tp), nc)) { m[9] = -1; tp = nullptr; }
    V d = v(m + 3);
    if (tp) {
      V aim = norm(sub(lead(v(m), v(tp), v(tp + 7), m[6]), v(m)));
      float ang = acosf_(dot(d, aim)), mx = m[11] * dt;
      if (ang > 1e-4f) { float s = mx / ang; d = norm(add(d, sub(aim, d), s > 1 ? 1 : s)); put(m + 3, d); }
    }
    V a = v(m), e = add(a, d, m[6] * dt);
    put(m, e);
    bool spent = m[7] <= 0 || e.y < heightAt(e.x, e.z);
    if (tp && m[8] > 0.25f && segHits(a, e, v(tp), 14)) { addHit(t, e, 1); spent = true; }
    if (spent) continue;
    if (w != k) for (int j = 0; j < MS; j++) M[w * MS + j] = m[j];
    w++;
  }
  return w;
}

// The nearest live plane of another team inside a cone ahead of plane i within range, that i can see.
EXPORT(lockable) int lockable(int i, int np, int nc, float cone, float range) {
  const float* p = P + i * PS;
  V f = rot(p + 3, FWD);
  int best = -1; float bd = range;
  for (int j = 0; j < np; j++) {
    const float* e = P + j * PS;
    if (j == i || e[15] < 0.5f || e[16] == p[16]) continue;
    V to = sub(v(e), v(p)); float d = len(to);
    if (d < bd && d > 1 && acosf_(dot(f, to) / d) < cone && clear(v(p), v(e), nc)) { best = j; bd = d; }
  }
  return best;
}

// Angle between plane i's nose and plane j, and the distance: OUT[0], OUT[1].
EXPORT(bearing) void bearing(int i, int j) {
  const float* p = P + i * PS; V to = sub(v(P + j * PS), v(p)); float d = len(to);
  OUT[0] = d > 1e-6f ? acosf_(dot(rot(p + 3, FWD), to) / d) : 0; OUT[1] = d;
}
