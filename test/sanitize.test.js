/**
 * core.js の中核ロジックに対する簡易テスト。
 * Node.js組み込みの node:test / node:assert のみを使用し、外部テストライブラリには依存しない。
 * 実行方法: npm test
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const HankakuNumPlugin = require(path.join(__dirname, '..', 'src', 'js', 'core.js'));
const { toHalfWidthDigits, sanitizeValue, getCaretOffsetAdjustment } = HankakuNumPlugin;

test('toHalfWidthDigits: 全角数字を半角に変換する', () => {
  assert.strictEqual(toHalfWidthDigits('０１２３４５６７８９'), '0123456789');
});

test('toHalfWidthDigits: 全角ハイフン類を半角ハイフンに変換する', () => {
  assert.strictEqual(toHalfWidthDigits('０１－ー―２３'), '01---23');
});

test('toHalfWidthDigits: 全角ピリオドを半角ピリオドに変換する', () => {
  assert.strictEqual(toHalfWidthDigits('１．５'), '1.5');
});

test('toHalfWidthDigits: 半角文字や無関係な文字はそのまま', () => {
  assert.strictEqual(toHalfWidthDigits('abc123-.'), 'abc123-.');
});

test('toHalfWidthDigits: 文字列以外を渡した場合はそのまま返す', () => {
  assert.strictEqual(toHalfWidthDigits(null), null);
  assert.strictEqual(toHalfWidthDigits(undefined), undefined);
});

test('sanitizeValue: allowType=digit は数字以外を全て除去する', () => {
  assert.strictEqual(sanitizeValue('１２-3.4a5', 'digit'), '12345');
});

test('sanitizeValue: allowType=digit_hyphen は数字とハイフンのみ残す', () => {
  assert.strictEqual(sanitizeValue('０１２-３４５.６７a', 'digit_hyphen'), '012-34567');
});

test('sanitizeValue: allowType=digit_hyphen_dot は数字・ハイフン・ピリオドのみ残す', () => {
  assert.strictEqual(sanitizeValue('０１-２３．４５a', 'digit_hyphen_dot'), '01-23.45');
});

test('sanitizeValue: 全角ハイフン類は半角ハイフンとして許可される', () => {
  assert.strictEqual(sanitizeValue('０１ー２３―４５', 'digit_hyphen'), '01-23-45');
});

test('sanitizeValue: 未知のallowTypeはdigit扱いにフォールバックする', () => {
  assert.strictEqual(sanitizeValue('12-34', 'unknown_type'), '1234');
});

test('sanitizeValue: 文字列以外の入力は空文字を返す', () => {
  assert.strictEqual(sanitizeValue(null, 'digit'), '');
  assert.strictEqual(sanitizeValue(123, 'digit'), '');
});

test('getCaretOffsetAdjustment: 除去文字がない場合は0を返す', () => {
  assert.strictEqual(getCaretOffsetAdjustment('123', '123', 2), 0);
});

test('getCaretOffsetAdjustment: 除去文字数とキャレット位置の小さい方を返す', () => {
  // "1a2a3" (5文字) -> "123" (3文字) : 差分2
  assert.strictEqual(getCaretOffsetAdjustment('1a2a3', '123', 5), 2);
  // キャレットが先頭に近い場合は、キャレット位置自体が上限になる
  assert.strictEqual(getCaretOffsetAdjustment('1a2a3', '123', 1), 1);
});

test('getCaretOffsetAdjustment: キャレット位置が0の場合は0を返す', () => {
  assert.strictEqual(getCaretOffsetAdjustment('1a2', '12', 0), 0);
});

test('getCaretOffsetAdjustment: 文字列が増える場合(全角->半角で長さが変わらないケース以外)は0を返す', () => {
  assert.strictEqual(getCaretOffsetAdjustment('12', '123', 2), 0);
});
