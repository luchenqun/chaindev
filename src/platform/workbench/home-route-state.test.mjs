import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isCosmosHomeRouteActive,
  isEvmRouteActive,
} from './home-route-state.ts';

test('root route follows the active mode for cosmos home data', () => {
  assert.equal(isCosmosHomeRouteActive('/', 'cosmos'), true);
  assert.equal(isCosmosHomeRouteActive('/', 'evm'), false);
});

test('root route follows the active mode for evm data', () => {
  assert.equal(isEvmRouteActive('/', 'evm'), true);
  assert.equal(isEvmRouteActive('/', 'cosmos'), false);
});

test('explicit chain routes do not depend on the root active mode', () => {
  assert.equal(isCosmosHomeRouteActive('/cosmos/overview', 'evm'), true);
  assert.equal(isCosmosHomeRouteActive('/cosmos/validators', 'cosmos'), false);
  assert.equal(isEvmRouteActive('/evm/blocks', 'cosmos'), true);
  assert.equal(isEvmRouteActive('/cosmos/blocks', 'evm'), false);
});
