import test from 'node:test';
import assert from 'node:assert/strict';
import { item, load, order, product } from './helpers.mjs';

const { normalizeProductName, parseCustomerTargets, getCustomerFulfillment, isCustomerOrderComplete } = load('lib/customers');
const customer = (notes, id = 'k1') => ({ id, name: 'Pelanggan', notes });

test('normalizeProductName: case, punctuation and spacing', () => {
  assert.equal(normalizeProductName('  Mie   AYAM  '), 'mie ayam');
  assert.equal(normalizeProductName('Es-Teh (Manis)'), 'es teh manis');
  assert.equal(normalizeProductName(null), '');
});

test('normalizeProductName: Indonesian number words equal digits', () => {
  assert.equal(normalizeProductName('Mie Level Tiga'), normalizeProductName('mie level 3'));
  // Known limitation: only joined teens ("duabelas") are converted; the spaced form "dua belas" is read as "2 belas".
  assert.equal(normalizeProductName('duabelas'), '12');
  assert.equal(normalizeProductName('dua puluh'), '20');
  assert.equal(normalizeProductName('sebelas'), '11');
});

test('parseCustomerTargets: the LAST number is the quantity, numbers inside the name stay in the name', () => {
  const targets = parseCustomerTargets(customer('Mie Ayam Level 3 10\nEs Teh Manis 5'));
  assert.deepEqual(targets, [{ name: 'Mie Ayam Level 3', qty: 10 }, { name: 'Es Teh Manis', qty: 5 }]);
});

test('parseCustomerTargets: prefixes, "x" notation, unit suffixes and separators', () => {
  assert.deepEqual(parseCustomerTargets(customer('pesan Pangsit Goreng x 6')), [{ name: 'Pangsit Goreng', qty: 6 }]);
  assert.deepEqual(parseCustomerTargets(customer('Mie 2 porsi')), [{ name: 'Mie', qty: 2 }]);
  assert.deepEqual(parseCustomerTargets(customer('Mie 2; Es Teh 3, Kerupuk 1')), [
    { name: 'Mie', qty: 2 }, { name: 'Es Teh', qty: 3 }, { name: 'Kerupuk', qty: 1 },
  ]);
});

test('parseCustomerTargets: duplicates merge, free text and empty notes are ignored', () => {
  assert.deepEqual(parseCustomerTargets(customer('Es Teh 2, es teh 3')), [{ name: 'Es Teh', qty: 5 }]);
  assert.deepEqual(parseCustomerTargets(customer('Pelanggan setia, suka pedas')), []);
  assert.deepEqual(parseCustomerTargets(customer('')), []);
  assert.deepEqual(parseCustomerTargets(customer(null)), []);
});

test('getCustomerFulfillment: counts completed orders of that customer by product id, capped at the target', () => {
  const products = [product('p1', 'Mie Ayam Level 3')];
  const orders = [order('o1', 'k1'), order('o2', 'k1'), order('o3', 'k1', 'pending'), order('o4', 'k1', 'cancelled'), order('o5', 'k2')];
  const items = [item('o1', 'p1', 'Mie Ayam Level 3', 4), item('o2', 'p1', 'Mie Ayam Level 3', 9), item('o3', 'p1', 'Mie Ayam Level 3', 5), item('o4', 'p1', 'x', 5), item('o5', 'p1', 'x', 5)];
  const [result] = getCustomerFulfillment('k1', [{ name: 'mie ayam level tiga', qty: 10 }], orders, items, products);
  assert.equal(result.fulfilled, 10);          // 4 + 9 = 13, capped at 10; pending, cancelled and other customers excluded
  assert.equal(result.productExists, true);
  assert.equal(result.productId, 'p1');
  assert.equal(result.name, 'Mie Ayam Level 3');   // canonical product name replaces the typed one
});

test('getCustomerFulfillment: never matches a similar-looking different product', () => {
  const products = [product('p1', 'Mie Ayam Level 3'), product('p2', 'Mie Ayam Level 5')];
  const orders = [order('o1', 'k1')];
  const items = [item('o1', 'p2', 'Mie Ayam Level 5', 7)];
  const [result] = getCustomerFulfillment('k1', [{ name: 'Mie Ayam Level 3', qty: 7 }], orders, items, products);
  assert.equal(result.fulfilled, 0);
});

test('getCustomerFulfillment: target created before the menu exists only matches legacy items without product id', () => {
  const orders = [order('o1', 'k1')];
  const items = [item('o1', null, 'Pangsit Goreng', 3), item('o1', 'p9', 'Pangsit Goreng', 4)];
  const [result] = getCustomerFulfillment('k1', [{ name: 'pangsit goreng', qty: 5 }], orders, items, []);
  assert.equal(result.fulfilled, 3);
  assert.equal(result.productExists, false);
  assert.equal(result.productId, null);
});

test('isCustomerOrderComplete: without targets any completed order counts', () => {
  assert.equal(isCustomerOrderComplete(customer(''), [order('o1', 'k1', 'pending')], [], []), false);
  assert.equal(isCustomerOrderComplete(customer(''), [order('o1', 'k1')], [], []), true);
  assert.equal(isCustomerOrderComplete(customer(''), [order('o1', 'k2')], [], []), false);
});

test('isCustomerOrderComplete: with targets every target must be fulfilled', () => {
  const products = [product('p1', 'Mie'), product('p2', 'Es Teh')];
  const orders = [order('o1', 'k1')];
  const partial = [item('o1', 'p1', 'Mie', 2)];
  const full = [item('o1', 'p1', 'Mie', 2), item('o1', 'p2', 'Es Teh', 3)];
  const c = customer('Mie 2\nEs Teh 3');
  assert.equal(isCustomerOrderComplete(c, orders, partial, products), false);
  assert.equal(isCustomerOrderComplete(c, orders, full, products), true);
});
