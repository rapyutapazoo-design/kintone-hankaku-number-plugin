/**
 * 半角数字入力プラグイン 設定画面ロジック (config.js)
 * core.js に依存する（sanitizeValue等は使わないが、fields保存フォーマットの
 * 慣習を統一するため同じ名前空間 HankakuNumPlugin を利用可能にしている）。
 */
(function (PLUGIN_ID) {
  'use strict';

  var ALLOW_TYPE_LABELS = {
    digit: '数字のみ（0-9）',
    digit_hyphen: '数字とハイフン（0-9, -）',
    digit_hyphen_dot: '数字・ハイフン・ピリオド（0-9, -, .）'
  };

  var TARGET_FIELD_TYPES = ['SINGLE_LINE_TEXT', 'NUMBER', 'LINK'];

  var fieldCandidates = [];

  /**
   * kintoneのフォーム設定APIから、対象フィールドタイプの候補を取得する。
   * サブテーブル(SUBTABLE)配下のフィールドはトップレベルを走査しないため
   * 自動的に除外される。
   * @param {number|string} appId
   * @returns {Promise<Array<{code:string, label:string, type:string}>>}
   */
  function fetchFieldCandidates(appId) {
    return kintone
      .api(kintone.api.url('/k/v1/preview/app/form/fields', true), 'GET', { app: appId })
      .then(function (resp) {
        var properties = (resp && resp.properties) || {};
        var candidates = [];
        Object.keys(properties).forEach(function (code) {
          var prop = properties[code];
          if (!prop || TARGET_FIELD_TYPES.indexOf(prop.type) === -1) {
            return;
          }
          candidates.push({
            code: code,
            label: (prop.label ? prop.label + ' ' : '') + '(' + code + ')',
            type: prop.type
          });
        });
        return candidates;
      });
  }

  /**
   * フィールド1行分のDOM（フィールドselect + 許可文字set select + 削除ボタン）を生成する。
   * @param {HTMLElement} container 行を追加する親要素（#field-rows）
   * @param {Array} candidates フィールド候補
   * @param {{code?: string, allowType?: string}} [savedRow] 復元する保存値
   * @returns {HTMLElement} 生成した行要素
   */
  function renderFieldRow(container, candidates, savedRow) {
    savedRow = savedRow || {};

    var row = document.createElement('div');
    row.className = 'hankaku-config-row';

    var fieldSelect = document.createElement('select');
    fieldSelect.className = 'hankaku-config-field-select';

    var emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = '-- フィールドを選択 --';
    fieldSelect.appendChild(emptyOption);

    candidates.forEach(function (candidate) {
      var option = document.createElement('option');
      option.value = candidate.code;
      option.textContent = candidate.label;
      if (savedRow.code === candidate.code) {
        option.selected = true;
      }
      fieldSelect.appendChild(option);
    });

    var allowSelect = document.createElement('select');
    allowSelect.className = 'hankaku-config-allow-select';
    Object.keys(ALLOW_TYPE_LABELS).forEach(function (key) {
      var option = document.createElement('option');
      option.value = key;
      option.textContent = ALLOW_TYPE_LABELS[key];
      if ((savedRow.allowType || 'digit') === key) {
        option.selected = true;
      }
      allowSelect.appendChild(option);
    });

    var removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'hankaku-config-button-remove';
    removeButton.textContent = '削除';
    removeButton.addEventListener('click', function () {
      removeFieldRow(row);
    });

    row.appendChild(fieldSelect);
    row.appendChild(allowSelect);
    row.appendChild(removeButton);
    container.appendChild(row);

    return row;
  }

  function addFieldRow() {
    var container = document.getElementById('field-rows');
    renderFieldRow(container, fieldCandidates);
  }

  function removeFieldRow(rowEl) {
    if (rowEl && rowEl.parentNode) {
      rowEl.parentNode.removeChild(rowEl);
    }
  }

  /**
   * 画面上の全行から選択値を収集する。
   * @returns {Array<{code: string, allowType: string}>}
   */
  function collectRows() {
    var container = document.getElementById('field-rows');
    var rowEls = container ? container.querySelectorAll('.hankaku-config-row') : [];
    var rows = [];
    Array.prototype.forEach.call(rowEls, function (rowEl) {
      var fieldSelect = rowEl.querySelector('.hankaku-config-field-select');
      var allowSelect = rowEl.querySelector('.hankaku-config-allow-select');
      rows.push({
        code: fieldSelect ? fieldSelect.value : '',
        allowType: allowSelect ? allowSelect.value : 'digit'
      });
    });
    return rows;
  }

  /**
   * 保存前のバリデーション。
   * - code が空の行は保存対象から除外する（エラーにはしない）
   * - 有効な行が1件も無ければエラー
   * - code の重複はエラー
   * @param {Array<{code: string, allowType: string}>} rows
   * @returns {{valid: boolean, error?: string, rows: Array}}
   */
  function validateConfig(rows) {
    var effectiveRows = rows.filter(function (row) {
      return row.code && row.code !== '';
    });

    if (effectiveRows.length === 0) {
      return { valid: false, error: '少なくとも1つ以上のフィールドを選択してください。', rows: [] };
    }

    var seen = {};
    for (var i = 0; i < effectiveRows.length; i++) {
      var code = effectiveRows[i].code;
      if (seen[code]) {
        return { valid: false, error: '同じフィールドが複数回選択されています: ' + code, rows: [] };
      }
      seen[code] = true;
    }

    return { valid: true, rows: effectiveRows };
  }

  function showError(message) {
    var errorEl = document.getElementById('error-message');
    if (!errorEl) {
      return;
    }
    if (!message) {
      errorEl.style.display = 'none';
      errorEl.textContent = '';
      return;
    }
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }

  function saveConfig() {
    showError('');
    var rows = collectRows();
    var result = validateConfig(rows);
    if (!result.valid) {
      showError(result.error);
      return;
    }

    var highlightToggle = document.getElementById('highlight-toggle');
    var configToSave = {
      fields: JSON.stringify(result.rows),
      highlight: highlightToggle && highlightToggle.checked ? 'true' : 'false'
    };

    kintone.plugin.app.setConfig(configToSave, function () {
      location.href = '../../flow?app=' + kintone.app.getId();
    });
  }

  /**
   * 保存済み設定を読み込み、フィールド候補とマージして画面に復元する。
   */
  function loadConfig() {
    var appId = kintone.app.getId();
    var savedConfig = HankakuNumPlugin.parseConfig(PLUGIN_ID);

    fetchFieldCandidates(appId)
      .then(function (candidates) {
        fieldCandidates = candidates;

        var container = document.getElementById('field-rows');
        container.innerHTML = '';

        if (savedConfig.fields.length === 0) {
          renderFieldRow(container, fieldCandidates);
        } else {
          savedConfig.fields.forEach(function (savedRow) {
            renderFieldRow(container, fieldCandidates, savedRow);
          });
        }

        var highlightToggle = document.getElementById('highlight-toggle');
        if (highlightToggle) {
          highlightToggle.checked = !!savedConfig.highlight;
        }
      })
      .catch(function (err) {
        showError('フィールド一覧の取得に失敗しました。画面を再読み込みしてください。');
        console.error('[半角数字入力プラグイン] fetchFieldCandidates失敗', err);
      });
  }

  kintone.events.on('app.config.show', function (event) {
    loadConfig();

    document.getElementById('add-field-row').addEventListener('click', addFieldRow);
    document.getElementById('save-config').addEventListener('click', saveConfig);

    return event;
  });
})(kintone.$PLUGIN_ID);
