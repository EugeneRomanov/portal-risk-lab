import assert from 'node:assert/strict';
import test from 'node:test';

import { applyPortalAction, calculateRisk, getRiskLevel, validateAction, type Portal } from '../lib/portal-engine.ts';

const portal: Portal = { id: 'test', name: 'Тестовый контур', world: 'Тест', energy: 96, stability: 12, minutesToCollapse: 42, beings: 3, status: 'open', note: '' };

void test('критический портал получает риск не ниже 80', () => {
  assert.equal(getRiskLevel(calculateRisk(portal)), 'critical');
});

void test('стабилизация снижает риск и увеличивает запас времени', () => {
  const stabilized = applyPortalAction(portal, 'stabilize');
  assert.ok(calculateRisk(stabilized) < calculateRisk(portal));
  assert.ok(stabilized.minutesToCollapse > portal.minutesToCollapse);
});

void test('наблюдателя нельзя отправить в критический портал', () => {
  const result = validateAction(portal, 'observe');
  assert.equal(result.allowed, false);
  assert.match(result.reason ?? '', /критический/i);
});

void test('закрытие портала с существами требует подтверждения', () => {
  const result = validateAction(portal, 'close');
  assert.equal(result.allowed, true);
  assert.equal(result.requiresConfirmation, true);
});

void test('закрытый портал нельзя стабилизировать', () => {
  const closed: Portal = { ...portal, status: 'closed' };
  assert.equal(validateAction(closed, 'stabilize').allowed, false);
});
