# 引き継ぎメモ (Claude Code → codex) — 2026-07-08

CC でやっていた `/tako/[token]` ロック画面改修は **本番公開まで完了**。codex はここから
新規改修を始めてよい。以下は「直前に何が出荷されたか」と「このリポの落とし穴」の記録。

## 直前に出荷したもの (完了・本番反映済み)

- コミット `e047ebd` 「feat(tako): ロック状態を刷新（あと3人画像・QR/シェア簡素化・FVヒーロー最上部）」
- `origin/main` に push 済み → Vercel が自動デプロイ、本番 **READY** (target: production)。
- 変更ファイル: `TakoLockedState.tsx` / `tako/[token]/page.tsx`(モックに `friends` 追加) /
  `LockedInviteShare.tsx` / `generate-image-manifest.mjs` + 生成物 `character-images.json` /
  招待ビジュアル `public/tako/`(ato-3.png, hero-loop.mp4, steps/)。
- プレビューURL(dev/`?fromPreview=1`): `/tako/preview?previewLocked=1&friends=2`(ロック) /
  `/tako/preview?previewType=rabbit__N`(解除後)。

## このリポの落とし穴 (codex も踏む)

- **ローカルの dev/build は必ず webpack**: `npm run dev` / `npm run build:local`。
  Turbopack はパス内の濁点(「ウサギ」= NFD)でパスバグを踏む。Vercel側(`npm run build`)はTurbopackでOK。
- **`next build` は ESLint を走らせない** (Next 16)。lint は `npx eslint` を別途。現在 8 error /
  7 warning あるが**全て差分外の既存ファイル**でビルド/デプロイは止まらない (別タスク化推奨):
  `TypeIntroModal.tsx:21` / `UnlockConfirming.tsx:31` (set-state-in-effect) /
  `admin-stats.ts:12` (no-explicit-any) / `EvaluationChapters.tsx:262`・`diagnosis.ts:206` (未使用, warning)。
- **`src/generated/character-images.json` は自動生成物**。手編集しない (`prebuild` で再生成)。
- 32キャラ画像はコードが `/characters/v3/<slug>.png` を直接参照。`v3/characters/`(重複展開) と
  `v3/characters.zip`(29MB配布書庫) は未参照 → `.gitignore` 済み。

## デプロイ

- GitHub `main` への push で Vercel が自動本番デプロイ (手動 CLI 不要)。
- 大きめの変更を出す前に Vercel 側の環境変数が最新かだけ確認する。
