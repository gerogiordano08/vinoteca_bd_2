const { test } = require('node:test');
const assert = require('node:assert/strict');
const { paginasVisibles } = require('../src/util/vistas');

test('paginación: la primera, la última y dos de cada lado de la actual, con saltos', () => {
  assert.deepEqual(paginasVisibles(1, 2), [1, 2]);
  assert.deepEqual(paginasVisibles(1, 9030), [1, 2, 3, null, 9030]);
  assert.deepEqual(paginasVisibles(5000, 9030), [1, null, 4998, 4999, 5000, 5001, 5002, null, 9030]);
  assert.deepEqual(paginasVisibles(9030, 9030), [1, null, 9028, 9029, 9030]);
  assert.deepEqual(paginasVisibles(4, 9030), [1, 2, 3, 4, 5, 6, null, 9030]);   // sin "…" entre 1 y 2
  assert.deepEqual(paginasVisibles(3, 5), [1, 2, 3, 4, 5]);
  assert.deepEqual(paginasVisibles(1, 1), [1]);
});
