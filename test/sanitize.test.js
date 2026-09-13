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

// --- フィールド要素の解決ロジック ---

const { buildFieldIdMapFrom, resolveFieldElement, applyToFields } = HankakuNumPlugin;

test('buildFieldIdMapFrom: フィールドコードをキーにフィールドIDへ引けるマップを返す', () => {
  const fieldList = {
    13312695: { var: 'room_number', type: 'SINGLE_LINE_TEXT', label: '部屋番号' },
    13312698: { var: 'opinion_subject', type: 'SINGLE_LINE_TEXT', label: '件名' }
  };
  assert.deepStrictEqual(buildFieldIdMapFrom(fieldList), {
    room_number: '13312695',
    opinion_subject: '13312698'
  });
});

test('buildFieldIdMapFrom: var を持たない定義は無視する', () => {
  const fieldList = {
    1: { type: 'RECORD_ID' },
    2: { var: 'code_a', type: 'SINGLE_LINE_TEXT' },
    3: null
  };
  assert.deepStrictEqual(buildFieldIdMapFrom(fieldList), { code_a: '2' });
});

test('buildFieldIdMapFrom: 不正な入力では空マップを返す', () => {
  assert.deepStrictEqual(buildFieldIdMapFrom(null), {});
  assert.deepStrictEqual(buildFieldIdMapFrom(undefined), {});
  assert.deepStrictEqual(buildFieldIdMapFrom('not-an-object'), {});
});

test('resolveFieldElement: 公式APIが要素を返す場合はそれを採用する', () => {
  const fakeEl = { tagName: 'DIV' };
  const resolved = resolveFieldElement('room_number', () => fakeEl);
  assert.strictEqual(resolved.element, fakeEl);
  assert.strictEqual(resolved.strategy, 'getFieldElement');
});

test('resolveFieldElement: 公式APIが例外を投げてもフォールバックへ進む', () => {
  const resolved = resolveFieldElement('room_number', () => {
    throw new Error('deprecated API failure');
  });
  // Node環境には cybozu.data.page も document も存在しないため解決できない
  assert.strictEqual(resolved.element, null);
  assert.strictEqual(resolved.strategy, 'none');
});

test('resolveFieldElement: 公式APIが null を返した場合も解決できなければ strategy=none', () => {
  const resolved = resolveFieldElement('room_number', () => null);
  assert.strictEqual(resolved.element, null);
  assert.strictEqual(resolved.strategy, 'none');
});

test('applyToFields: 解決できたフィールド数をサマリーとして返す', () => {
  const input = {
    dataset: {},
    setAttribute() {},
    addEventListener() {},
    classList: { add() {}, remove() {} }
  };
  const fieldEl = { querySelector: () => input };
  const summary = applyToFields(
    [{ code: 'room_number', allowType: 'digit' }],
    () => fieldEl,
    false
  );
  assert.strictEqual(summary.bound, 1);
  assert.strictEqual(summary.total, 1);
  assert.deepStrictEqual(summary.strategies, { getFieldElement: 1 });
});

test('applyToFields: 要素を解決できないフィールドは bound に数えない', () => {
  const summary = applyToFields([{ code: 'missing', allowType: 'digit' }], () => null, false);
  assert.strictEqual(summary.bound, 0);
  assert.strictEqual(summary.total, 1);
});

test('applyToFields: 設定が配列でない場合も安全にサマリーを返す', () => {
  const summary = applyToFields(null, () => null, false);
  assert.deepStrictEqual(summary, { bound: 0, total: 0, strategies: {} });
});
