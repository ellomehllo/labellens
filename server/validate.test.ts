import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkImages } from './validate.ts';

test('images must match their declared type', () => {
  const png = Buffer.alloc(200);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png);
  assert.equal(checkImages({ images: [{ media_type: 'image/png', data: png.toString('base64') }] }).length, 1);
  assert.throws(() => checkImages({ images: [{ media_type: 'image/jpeg', data: png.toString('base64') }] }), /valid image/);
  assert.throws(() => checkImages({ images: [] }), /at least one/);
  assert.throws(() => checkImages({ images: Array(5).fill({ media_type: 'image/png', data: 'AA==' }) }), /up to 4/);
});
