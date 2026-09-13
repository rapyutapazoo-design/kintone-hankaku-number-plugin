/**
 * 半角数字入力プラグイン 共通ロジック (core.js)
 *
 * desktop.js / mobile.js / config.js のいずれからも読み込まれる共通モジュール。
 * kintoneの実行コンテキストはファイルごとに独立しているため、
 * manifest.json の desktop.js / mobile.js / config.js 配列すべてに
 * このファイルを重複登録する必要がある。
 *
 * ブラウザの IME 変換モードは JavaScript から直接制御する API が存在しない
 * （`ime-mode` CSS も旧IE/Edge専用で現行ブラウザでは無効）。
 * そのため「IMEモードを変える」のではなく「最終的な入力値を必ず半角数字
 * （＋許可記号）に変換する」方式でこの制約を回避する。
 */
(function (global) {
  'use strict';

  /**
   * 許可文字セットごとの「許可されない文字」にマッチする正規表現。
   * sanitizeValue はこの正規表現にマッチした文字を除去する。
   */
  var ALLOW_PATTERNS = {
    digit: /[^0-9]/g,
    digit_hyphen: /[^0-9\-]/g,
    digit_hyphen_dot: /[^0-9\-.]/g
  };

  /**
   * 全角数字・全角ハイフン類・全角ピリオドを半角に変換する。
   * @param {string} str
   * @returns {string}
   */
  function toHalfWidthDigits(str) {
    if (typeof str !== 'string') {
      return str;
    }
    return str
      // 全角数字 ０-９ -> 0-9
      .replace(/[０-９]/g, function (ch) {
        return String.fromCharCode(ch.charCodeAt(0) - 0xfee0);
      })
      // 全角ハイフン・長音記号・全角ダッシュ -> 半角ハイフン
      .replace(/[－ー―]/g, '-')
      // 全角ピリオド -> 半角ピリオド
      .replace(/．/g, '.');
  }

  /**
   * 生の入力値を、許可文字セットに基づいてサニタイズする。
   * @param {string} rawValue
   * @param {string} allowType "digit" | "digit_hyphen" | "digit_hyphen_dot"
   * @returns {string}
   */
  function sanitizeValue(rawValue, allowType) {
    if (typeof rawValue !== 'string') {
      return '';
    }
    var halfWidth = toHalfWidthDigits(rawValue);
    var pattern = ALLOW_PATTERNS[allowType] || ALLOW_PATTERNS.digit;
    return halfWidth.replace(pattern, '');
  }

  /**
   * サニタイズ前後の文字列長の差分から、キャレット位置の補正量を計算する。
   * サニタイズによって文字が除去された分だけキャレットを前方に詰める。
   * @param {string} before サニタイズ前の文字列
   * @param {string} after サニタイズ後の文字列
   * @param {number} caretPos サニタイズ前のキャレット位置
   * @returns {number} 補正量（caretPos から差し引く文字数）
   */
  function getCaretOffsetAdjustment(before, after, caretPos) {
    if (typeof before !== 'string' || typeof after !== 'string') {
      return 0;
    }
    var lengthDiff = before.length - after.length;
    if (lengthDiff <= 0 || typeof caretPos !== 'number' || caretPos <= 0) {
      return 0;
    }
    // キャレットより前で除去された文字数を正確に追跡するのは複雑になるため、
    // 「除去された文字数」と「キャレット位置」の小さい方を採用する近似で十分な精度を得る。
    return Math.min(lengthDiff, caretPos);
  }

  /**
   * 1つの input 要素にサニタイズ処理をバインドする。
   * @param {HTMLInputElement} inputEl
   * @param {string} allowType
   * @param {{highlight?: boolean}} [options]
   */
  function bindSanitizer(inputEl, allowType, options) {
    if (!inputEl || !inputEl.addEventListener) {
      return;
    }
    // 二重バインド防止
    if (inputEl.dataset && inputEl.dataset.hankakuBound === 'true') {
      return;
    }
    if (inputEl.dataset) {
      inputEl.dataset.hankakuBound = 'true';
    }

    options = options || {};

    // モバイルで適切な数字キーパッドを呼び出すための inputmode 属性
    inputEl.setAttribute('inputmode', allowType === 'digit' ? 'numeric' : 'decimal');

    var isComposing = false;
    var isProgrammaticChange = false;

    function applySanitize() {
      if (isProgrammaticChange) {
        return;
      }
      var before = inputEl.value;
      var caretPos = inputEl.selectionStart;
      if (typeof caretPos !== 'number') {
        caretPos = before.length;
      }
      var after = sanitizeValue(before, allowType);
      if (after === before) {
        return;
      }
      var adjustment = getCaretOffsetAdjustment(before, after, caretPos);
      var newCaret = caretPos - adjustment;
      if (newCaret < 0) {
        newCaret = 0;
      }
      if (newCaret > after.length) {
        newCaret = after.length;
      }

      isProgrammaticChange = true;
      inputEl.value = after;
      try {
        inputEl.setSelectionRange(newCaret, newCaret);
      } catch (e) {
        // number など setSelectionRange 非対応の input type は無視して継続する
      }
      try {
        // kintone側の内部状態（レコードオブジェクト）にサニタイズ後の値を
        // 反映させるため、変更を検知させる合成 input イベントを発火する。
        // isProgrammaticChange フラグにより、このイベントの再入でサニタイズが
        // 再実行され無限ループになることを防ぐ。
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      } catch (e) {
        // 古い環境でイベント生成に失敗しても致命的ではないため握りつぶす
      }
      isProgrammaticChange = false;
    }

    inputEl.addEventListener('compositionstart', function () {
      isComposing = true;
    });

    inputEl.addEventListener('compositionend', function () {
      isComposing = false;
      applySanitize();
    });

    inputEl.addEventListener('input', function (event) {
      if (isProgrammaticChange) {
        return;
      }
      // IME変換中（isComposing）は確定前の文字列を書き換えない
      if ((event && event.isComposing) || isComposing) {
        return;
      }
      applySanitize();
    });

    if (options.highlight) {
      inputEl.addEventListener('focus', function () {
        inputEl.classList.add('hankaku-num-active');
      });
      inputEl.addEventListener('blur', function () {
        inputEl.classList.remove('hankaku-num-active');
      });
    }
  }

  /**
   * フィールド設定の配列に基づき、各フィールドの input 要素にサニタイズをバインドする。
   * @param {Array<{code: string, allowType: string}>} fieldsConfig
   * @param {(code: string) => HTMLElement} getFieldElementFn
   * @param {boolean} highlightEnabled
   */
  function applyToFields(fieldsConfig, getFieldElementFn, highlightEnabled) {
    if (!Array.isArray(fieldsConfig) || typeof getFieldElementFn !== 'function') {
      return;
    }
    fieldsConfig.forEach(function (fieldConfig) {
      if (!fieldConfig || !fieldConfig.code) {
        return;
      }
      try {
        var fieldEl = getFieldElementFn(fieldConfig.code);
        if (!fieldEl) {
          console.warn('[半角数字入力プラグイン] フィールド要素を取得できません: ' + fieldConfig.code);
          return;
        }
        var inputEl = fieldEl.querySelector('input');
        if (!inputEl) {
          console.warn('[半角数字入力プラグイン] input要素が見つかりません: ' + fieldConfig.code);
          return;
        }
        bindSanitizer(inputEl, fieldConfig.allowType || 'digit', { highlight: !!highlightEnabled });
      } catch (e) {
        console.warn('[半角数字入力プラグイン] フィールド処理中にエラーが発生しました: ' + fieldConfig.code, e);
      }
    });
  }

  /**
   * kintoneのプラグイン設定を読み出し、fields配列とhighlightフラグに変換する。
   * @param {string} pluginId
   * @returns {{fields: Array, highlight: boolean}}
   */
  function parseConfig(pluginId) {
    var fields = [];
    var highlight = false;
    try {
      var storedConfig = (global.kintone && kintone.plugin && kintone.plugin.app.getConfig(pluginId)) || {};
      try {
        fields = JSON.parse(storedConfig.fields || '[]');
        if (!Array.isArray(fields)) {
          fields = [];
        }
      } catch (parseError) {
        fields = [];
      }
      highlight = storedConfig.highlight === 'true';
    } catch (e) {
      fields = [];
      highlight = false;
    }
    return { fields: fields, highlight: highlight };
  }

  var HankakuNumPlugin = {
    ALLOW_PATTERNS: ALLOW_PATTERNS,
    toHalfWidthDigits: toHalfWidthDigits,
    sanitizeValue: sanitizeValue,
    getCaretOffsetAdjustment: getCaretOffsetAdjustment,
    bindSanitizer: bindSanitizer,
    applyToFields: applyToFields,
    parseConfig: parseConfig
  };

  global.HankakuNumPlugin = HankakuNumPlugin;

  // Node.js (テスト実行環境) からロジック単体を読み込めるようにするための
  // CommonJS互換エクスポート。ブラウザ実行には影響しない。
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = HankakuNumPlugin;
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
