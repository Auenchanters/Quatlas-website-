// Compiles Dogfight Extreme's C++ core to WebAssembly: `npm run wasm`.
// Uses clang with wasm-ld (LLVM) if it is installed, else Emscripten's emcc. The .wasm is committed,
// so the site's own build (and Vercel) never needs either.
import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../src/games/dogfight/extreme/', import.meta.url));
const src = dir + 'core.cpp', out = dir + 'core.wasm';
// emcc is a .bat on Windows, which needs a shell; clang doesn't.
const shell = (cmd) => cmd === 'emcc' && process.platform === 'win32';
const has = (cmd) => { try { execFileSync(cmd, ['--version'], { stdio: 'ignore', shell: shell(cmd) }); return true; } catch { return false; } };
const winClang = 'C:/Program Files/LLVM/bin/clang.exe';
const clang = has('clang') ? 'clang' : existsSync(winClang) ? winClang : null;

// No libc, no runtime, no imports: only the functions marked EXPORT, and the memory.
const common = ['-O3', '-std=c++17', '-fno-exceptions', '-fno-rtti', '-nostdlib', src, '-o', out];
if (clang) execFileSync(clang, ['--target=wasm32', '-mbulk-memory', '-Wl,--no-entry', '-Wl,--strip-all', ...common], { stdio: 'inherit' });
else if (has('emcc')) execFileSync('emcc', ['--no-entry', '-sSTANDALONE_WASM', '-sFILESYSTEM=0', ...common], { stdio: 'inherit', shell: shell('emcc') });
else { console.error('No clang or emcc found. Install LLVM (winget install LLVM.LLVM) or Emscripten (emsdk).'); process.exit(1); }
console.log(`core.wasm: ${statSync(out).size} bytes`);
