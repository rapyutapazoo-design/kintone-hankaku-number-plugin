/**
 * 半角数字入力プラグイン デスクトップ版イベントハンドラ (desktop.js)
 * core.js に依存する。manifest.json の desktop.js では必ず core.js の後に読み込むこと。
 *
 * フィールド要素の解決は core.js の resolveFieldElement が担う。
 * kintone.app.record.getFieldElement() は非推奨APIで現行画面では null を返すため、
 * 第1候補として渡しつつ、実際の解決はフォールバック（.field-<fieldId>）に委ねている。
 */
(function (PLUGIN_ID) {
  'use strict';

  var LOG_PREFIX = '[半角数字入力プラグイン]';

  function bindAll() {
    var config = HankakuNumPlugin.parseConfig(PLUGIN_ID);
    return HankakuNumPlugin.applyToFields(
      config.fields,
      function (code) {
        return kintone.app.record.getFieldElement(code);
      },
      config.highlight
    );
  }

  kintone.events.on(['app.record.create.show', 'app.record.edit.show'], function (event) {
    var summary = bindAll();
    console.info(
      LOG_PREFIX + ' デスクトップ版: ' + summary.bound + '/' + summary.total +
        ' 件のフィールドにバインドしました（解決方法: ' + JSON.stringify(summary.strategies) + '）'
    );

    // kintoneがフィールドDOMを再描画した場合に備えて再バインドする。
    HankakuNumPlugin.observeAndRebind(bindAll);

    return event;
  });
})(kintone.$PLUGIN_ID);
