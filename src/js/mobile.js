/**
 * 半角数字入力プラグイン モバイル版イベントハンドラ (mobile.js)
 * core.js に依存する。manifest.json の mobile.js では必ず core.js の後に読み込むこと。
 *
 * フィールド要素の解決は core.js の resolveFieldElement が担う。
 * kintone.mobile.app.record.getFieldElement() もデスクトップ版と同様に
 * 現行画面では null を返すため、実際の解決はフォールバックに委ねている。
 */
(function (PLUGIN_ID) {
  'use strict';

  var LOG_PREFIX = '[半角数字入力プラグイン]';

  function bindAll() {
    var config = HankakuNumPlugin.parseConfig(PLUGIN_ID);
    return HankakuNumPlugin.applyToFields(
      config.fields,
      function (code) {
        return kintone.mobile.app.record.getFieldElement(code);
      },
      config.highlight
    );
  }

  kintone.events.on(['mobile.app.record.create.show', 'mobile.app.record.edit.show'], function (event) {
    var summary = bindAll();
    console.info(
      LOG_PREFIX + ' モバイル版: ' + summary.bound + '/' + summary.total +
        ' 件のフィールドにバインドしました（解決方法: ' + JSON.stringify(summary.strategies) + '）'
    );

    HankakuNumPlugin.observeAndRebind(bindAll);

    return event;
  });
})(kintone.$PLUGIN_ID);
