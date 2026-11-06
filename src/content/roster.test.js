import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TEAMS, ROSTER_SIZE } from './roster.js';
import { REPO_PHOTOS } from './gallery-tags.js';

const images = JSON.parse(readFileSync(new URL('./images.json', import.meta.url)));

test('every roster photo and repo gallery photo exists in public/img', () => {
  const names = [...TEAMS.flatMap((t) => t.roleData.map((p) => p.img)), ...REPO_PHOTOS.map((p) => p.img)].filter(Boolean);
  assert.deepEqual(names.filter((n) => !images[n]), []);
});

test('people in two subteams count once', () => {
  const listings = TEAMS.reduce((n, t) => n + t.roleData.length, 0);
  assert.ok(ROSTER_SIZE < listings);
  assert.equal(ROSTER_SIZE, 21);
});
