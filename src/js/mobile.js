/**
 * 半角数字入力プラグイン モバイル版イベントハンドラ (mobile.js)
 * core.js に依存する。manifest.json の mobile.js では必ず core.js の後に読み込むこと。
 */
(function (PLUGIN_ID) {
  'use strict';

  kintone.events.on(['mobile.app.record.create.show', 'mobile.app.record.edit.show'], function (event) {
    var config = HankakuNumPlugin.parseConfig(PLUGIN_ID);
    HankakuNumPlugin.applyToFields(
      config.fields,
      function (code) {
        return kintone.mobile.app.record.getFieldElement(code);
      },
      config.highlight
    );

    return event;
  });
})(kintone.$PLUGIN_ID);
