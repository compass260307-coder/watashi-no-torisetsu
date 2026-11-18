// 日本語Webの結果アップグレード7問と、Aliceの反応まわりの回帰テスト。
// 外部通信・AI呼び出し・DBアクセスは行わない。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function compile(path, imports = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    require(name) {
      if (name in imports) return imports[name];
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return exports;
}

const upgrade = compile('src/lib/result-upgrade.ts');
const prices = {
  LINE_RESULT_UPGRADE_COUPON_JPY: 499,
  LINE_RESULT_UPGRADE_LIST_PRICE_JPY: 1398,
  RESULT_UPGRADE_PRICE_JPY: 899,
};
const reaction = compile('src/lib/result-upgrade-reaction.ts', {
  '@/lib/result-upgrade': upgrade,
  '@/lib/access-products': prices,
});

// 宝箱が出るまでのAliceの読み込みの一言と、受け取り後の支払額。価格は共通定義から作る。
assert.equal(
  reaction.WEB_RESULT_UPGRADE_GIFT_LOADING_MESSAGE_V2,
  '完全版を購入してくれたあなたへ、プレゼントがあるよ！',
);
assert.equal(reaction.WEB_RESULT_UPGRADE_AFTER_GIFT_MESSAGE_V2, 'このクーポンを使うと、¥899で作れるよ！');

// クーポンの演出は抽選・期限に見せない（全員同額のため）。
const gift = readFileSync('src/components/result-upgrade/ResultUpgradeTreasure.tsx', 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');
assert.doesNotMatch(gift, /当たり|当選|抽選|ルーレット|残り|期限|今だけ/, 'クーポン演出に抽選・期限の表現を入れない');

const five = ['a', 'b', 'c', 'd', 'e'];
const seven = [...five, 'f', 'g'];

// 質問セット: 従来の5問は残し、日本語Webだけ7問。
assert.equal(upgrade.RESULT_UPGRADE_QUESTIONS.length, 5, 'LINE・保存済み回答用の5問を維持する');
assert.equal(upgrade.KO_RESULT_UPGRADE_QUESTIONS.length, 5, '韓国語は5問のまま');
assert.equal(upgrade.WEB_RESULT_UPGRADE_QUESTIONS_V2.length, 7);
assert.equal(reaction.WEB_RESULT_UPGRADE_QUESTION_MESSAGES_V2.length, 7);
assert.equal(reaction.WEB_RESULT_UPGRADE_ANSWER_USES_V2.length, 7);

// 回答数で、どの質問への回答かを判別する。
assert.equal(upgrade.resultUpgradeQuestionsForAnswers('ja', 7), upgrade.WEB_RESULT_UPGRADE_QUESTIONS_V2);
assert.equal(upgrade.resultUpgradeQuestionsForAnswers('ja', 5), upgrade.RESULT_UPGRADE_QUESTIONS);
assert.equal(upgrade.resultUpgradeQuestionsForAnswers(undefined, 5), upgrade.RESULT_UPGRADE_QUESTIONS);
assert.equal(upgrade.resultUpgradeQuestionsForAnswers('ko', 5), upgrade.KO_RESULT_UPGRADE_QUESTIONS);
assert.equal(upgrade.resultUpgradeQuestionsForAnswers('ko', 7), upgrade.KO_RESULT_UPGRADE_QUESTIONS);

// 完成済みの回答は5件か7件だけ。保存済みの5問回答は引き続き購入・生成できる。
assert.equal(upgrade.normalizeResultUpgradeAnswers(five)?.length, 5);
assert.equal(upgrade.normalizeResultUpgradeAnswers(seven)?.length, 7);
assert.equal(upgrade.normalizeResultUpgradeAnswers(seven.slice(0, 6)), null);
assert.equal(upgrade.normalizeResultUpgradeAnswers([...seven, 'h']), null);
assert.equal(upgrade.normalizeResultUpgradeAnswers(seven, [5]), null, 'LINE・韓国語は7問を受け付けない');
assert.equal(upgrade.normalizeResultUpgradeAnswers(['a', 'b', 'c', 'd', ' ']), null);
assert.equal(upgrade.normalizeResultUpgradeAnswers([...five.slice(0, 4), 'x'.repeat(501)]), null);

const answersRoute = readFileSync('src/app/api/result-upgrade/answers/route.ts', 'utf8');
assert.match(
  answersRoute,
  /lineFlow \|\| locale === "ko"\s*\? normalizeResultUpgradeAnswers\(body\.value\.answers, \[LEGACY_RESULT_UPGRADE_ANSWER_COUNT\]\)/,
  '回答保存APIはLINE・韓国語を5問に限定する',
);

// 反応APIは途中までの回答（1〜7件）を受け付ける。
assert.equal(reaction.normalizeResultUpgradeReactionAnswers(['ネコ'])?.length, 1);
assert.equal(reaction.normalizeResultUpgradeReactionAnswers(seven)?.length, 7);
assert.equal(reaction.normalizeResultUpgradeReactionAnswers([]), null);
assert.equal(reaction.normalizeResultUpgradeReactionAnswers([...seven, 'h']), null);
assert.equal(reaction.normalizeResultUpgradeReactionAnswers(['ネコ', '']), null);

// 定型文: 短い単語だけ引用し、文になっている回答や長い回答は引用しない。
assert.match(reaction.fallbackResultUpgradeReaction(0, 'ネコ'), /^「ネコ」/);
assert.doesNotMatch(reaction.fallbackResultUpgradeReaction(0, 'ネコ。気分屋だから'), /「/);
assert.doesNotMatch(reaction.fallbackResultUpgradeReaction(2, 'あ'.repeat(40)), /「/);
for (let index = 0; index < 7; index += 1) {
  const text = reaction.fallbackResultUpgradeReaction(index, 'テスト');
  assert.ok(text.length > 10 && !/[?？]$/.test(text), `定型文${index + 1}は疑問文で終わらない`);
}

// AI出力の整形: 引用で始まる文は残し、全体を包むかぎかっこだけ外す。
assert.equal(reaction.sanitizeResultUpgradeReaction('「ネコ」かぁ、いいね！'), '「ネコ」かぁ、いいね！');
assert.equal(reaction.sanitizeResultUpgradeReaction('「ネコなんだね、いいね」'), 'ネコなんだね、いいね');
assert.equal(reaction.sanitizeResultUpgradeReaction('  ネコ\nなんだね  '), 'ネコ なんだね');
assert.equal(reaction.sanitizeResultUpgradeReaction(''), null);
assert.equal(reaction.sanitizeResultUpgradeReaction('あ'.repeat(161)), null);
assert.equal(reaction.sanitizeResultUpgradeReaction(undefined), null);

// 生成プロンプトは回答数で質問セットを選び、7問のときだけ使い分けの指示を足す。
const generate = readFileSync('src/lib/result-upgrade/generate.ts', 'utf8');
assert.match(generate, /resultUpgradeQuestionsForAnswers\(locale, answers\.length\)/);
assert.equal(generate.match(/isWebResultUpgradeV2Answers\(row\.locale, row\.answers\.length\)/g)?.length, 2);

// 反応APIは本人確認・完全版の購入確認・利用上限を通し、開発用の入口は本番で無効。
const reactionRoute = readFileSync('src/app/api/result-upgrade/reaction/route.ts', 'utf8');
for (const guard of ['checkOrigin(request)', 'getResultUpgradeSession(request)', 'hasFullAccess(session.id)', 'consumeRateLimit(request']) {
  assert.ok(reactionRoute.includes(guard), `反応APIに ${guard} がある`);
}
const devRoute = readFileSync('src/app/api/dev/result-upgrade-reaction/route.ts', 'utf8');
assert.match(devRoute, /process\.env\.NODE_ENV !== "development"[\s\S]{0,80}status: 404/);

// クーポン券の絵には「¥499 OFF」が刺しゅうで描かれている。額を変えたら絵も作り直す。
assert.match(
  readFileSync('src/lib/access-products.ts', 'utf8'),
  /LINE_RESULT_UPGRADE_COUPON_JPY\s*=\s*499\b/,
  'クーポン額が変わったら public/result-upgrade/coupon-ticket-embroidered.webp を作り直す',
);

console.log('PASS: Japanese Web result upgrade uses seven questions with Alice reactions; LINE, Korean and saved five-answer rows keep the legacy flow. No external calls.');
