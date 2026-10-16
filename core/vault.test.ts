import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openVault, sealVault } from './vault.ts';

const contents = { apiKey: 'sk-proj-TEST-ONLY', provider: 'openai' as const, model: 'gpt-6-astra' };

test('a sealed vault opens with the right password and hides the key', async () => {
  const vault = await sealVault(contents, 'correct horse battery staple');
  assert.doesNotMatch(JSON.stringify(vault), /sk-proj|TEST-ONLY|gpt-6/);
  assert.deepEqual(await openVault(vault, 'correct horse battery staple'), contents);
});

test('a wrong password or tampered vault is rejected', async () => {
  const vault = await sealVault(contents, 'correct horse battery staple');
  await assert.rejects(openVault(vault, 'wrong password'), { code: 'wrong_password' });
  const tampered = { ...vault, data: vault.data.slice(0, -4) + 'AAAA' };
  await assert.rejects(openVault(tampered, 'correct horse battery staple'), { code: 'wrong_password' });
});

test('each seal uses a fresh salt and IV', async () => {
  const a = await sealVault(contents, 'correct horse battery staple');
  const b = await sealVault(contents, 'correct horse battery staple');
  assert.notEqual(a.salt, b.salt);
  assert.notEqual(a.iv, b.iv);
  assert.notEqual(a.data, b.data);
});
