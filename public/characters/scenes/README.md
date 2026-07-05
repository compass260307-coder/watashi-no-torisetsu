# シーン別挿絵 (結果ページの章間イラスト)

`<slug>_<variant>.png` の名前でこのフォルダに置くだけで /me 結果ページに自動表示される
(コード変更不要・無いものは非表示)。slug はキャラ画像 (v3/cut) と同じ。例: jellyfish_N

グループ共通の絵は `<group>_<variant>.png` (group = sea / land / sky / unknown)。
キャラ別ファイルがあればそちらが優先、無ければグループ共通にフォールバックする。

| variant | 表示位置 |
|---------|----------|
| normal1 | 取説パート1 (キャラ直下の本文) の後 |
| normal2 | 取説パート2 (〜注意) の後 |
| love    | 深掘り「恋愛傾向」タブ内 |
| work    | 深掘り「仕事」タブ内 |
| school  | 深掘り「成長」タブ内 |

例: jellyfish_N_normal1.png / jellyfish_N_love.png / jellyfish_N_work.png
