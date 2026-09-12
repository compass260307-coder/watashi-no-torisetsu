// JPのApps Scriptへ追加。通常同期には登録しない、一度だけの構造移行。
// 更新済み google-sheets-diagnosis-sync.gs と同じプロジェクトで実行する。
// Vercel/API呼び出し・トリガー追加・カーソル変更は行わない。
function upgradeAcquisitionMediumSheets() {
  const jpId = "1J7257eFLp8nhO6aUtZyML6hoNltbjHKg4D-nLkxoKec";
  const krId = "13uBekL9JZfzNWFxqiCQHOxTalFxBhx3scWFfdj6cGoU";
  const sharedName = "_KR診断共有";
  const oldFormula = '=ARRAYFORMULA(IFERROR(IMPORTRANGE("' + jpId + '","\'_KR共有データ\'!A1:H10000"),\'_作成時点データ\'!A1:H1307))';
  // 控えは8列なので、空欄2列を明示的に連結。過去のmediumを推定しない。
  // 共有タブのグリッドは10,000行。A:J参照で同じ容量・1本のimportを維持する。
  // 実ファイルではA1:J10000がImport Range internal errorとなり、こちらで検証済み。
  const newFormula = '=ARRAYFORMULA(IFERROR(IMPORTRANGE("https://docs.google.com/spreadsheets/d/' + jpId + '","\'' + sharedName + '\'!A:J"),HSTACK(\'_作成時点データ\'!A1:H1307,VSTACK({"acq_medium","acq_channel"},MAKEARRAY(1306,2,LAMBDA(r,c,""))))))';
  const sharedFormula = '={diagnoses_raw!A1:J1;IFNA(FILTER(diagnoses_raw!A2:J,diagnoses_raw!F2:F="ko"),MAKEARRAY(1,10,LAMBDA(r,c,"")))}';
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) throw new Error("同期中です。完了後に再実行してください");
  try {
    const cursorBefore = PropertiesService.getScriptProperties().getProperties();
    const triggerCountBefore = ScriptApp.getProjectTriggers().length;
    const jp = SpreadsheetApp.getActiveSpreadsheet();
    if (jp.getId() !== jpId) throw new Error("JP元ファイルから実行してください");
    const kr = SpreadsheetApp.openById(krId);
    const destination = kr.getSheetByName("diagnoses_raw");
    if (!destination) throw new Error("KRのdiagnoses_rawが見つかりません");
    const current = destination.getRange("A1").getFormula();
    if (current !== oldFormula && current !== newFormula) {
      throw new Error("KRの参照式が調査時点から変更されています。再確認が必要です");
    }
    let shared = jp.getSheetByName(sharedName);
    if (shared && shared.getLastRow() > 0 && shared.getRange("A1").getFormula() !== sharedFormula) {
      throw new Error("新しい共有タブに別のデータがあります");
    }
    // 旧A:H・I:V・W:APの配置と参照は一切動かさない。
    rawSheet_(RAW_SYNC_JOBS.diagnoses);
    if (!shared) shared = jp.insertSheet(sharedName);
    ensureRows_(shared, 10000);
    ensureColumns_(shared, 10);
    shared.getRange("A1").setFormula(sharedFormula);
    shared.hideSheet();
    ensureColumns_(destination, 10);
    destination.getRange("A1").setFormula(newFormula);
    SpreadsheetApp.flush();
    const cursorAfter = PropertiesService.getScriptProperties().getProperties();
    const cursorsUnchanged = Object.keys(cursorBefore).filter(function (key) { return key.indexOf("CURSOR") >= 0; })
      .every(function (key) { return cursorBefore[key] === cursorAfter[key]; });
    if (!cursorsUnchanged || ScriptApp.getProjectTriggers().length !== triggerCountBefore) {
      throw new Error("移行中にカーソルまたはトリガーが変更されました");
    }
    console.log(JSON.stringify({ acquisitionMediumUpgrade: "complete", cursorsUnchanged: cursorsUnchanged, triggerCount: triggerCountBefore }));
    if (destination.getRange("A1").getFormula() !== newFormula ||
        shared.getRange("A1").getFormula() !== sharedFormula) {
      throw new Error("参照式の書き込み検証に失敗しました");
    }
  } finally {
    lock.releaseLock();
  }
}
