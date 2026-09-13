/**
 * 半角数字入力プラグイン デスクトップ版イベントハンドラ (desktop.js)
 * core.js に依存する。manifest.json の desktop.js では必ず core.js の後に読み込むこと。
 */
(function (PLUGIN_ID) {
  'use strict';

  var DEBOUNCE_MS = 100;
  var debounceTimer = null;

  function bindAll() {
    var config = HankakuNumPlugin.parseConfig(PLUGIN_ID);
    HankakuNumPlugin.applyToFields(
      config.fields,
      function (code) {
        return kintone.app.record.getFieldElement(code);
      },
      config.highlight
    );
  }

  function scheduleRebind() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(function () {
      debounceTimer = null;
      bindAll();
    }, DEBOUNCE_MS);
  }

  kintone.events.on(['app.record.create.show', 'app.record.edit.show'], function (event) {
    bindAll();

    // kintoneがフィールドDOMを再描画した場合に備え、レコードフォーム領域を
    // MutationObserver で監視し、変化があれば debounce しつつ再バインドする。
    // 監視範囲を絞り、無限ループを防ぐため属性変化や自ページ内の再バインドは対象外とする。
    try {
      var formArea =
        document.querySelector('.record-gaia') ||
        document.querySelector('#record-edit') ||
        document.body;

      if (formArea && typeof MutationObserver !== 'undefined') {
        var observer = new MutationObserver(function (mutations) {
          var relevant = mutations.some(function (m) {
            return m.type === 'childList' && (m.addedNodes.length > 0 || m.removedNodes.length > 0);
          });
          if (relevant) {
            scheduleRebind();
          }
        });
        observer.observe(formArea, { childList: true, subtree: true });
      }
    } catch (e) {
      console.warn('[半角数字入力プラグイン] MutationObserverの設定に失敗しました', e);
    }

    return event;
  });
})(kintone.$PLUGIN_ID);
