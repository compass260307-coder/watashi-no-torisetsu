# /types キャラモーション動画 量産ガイド

性格タイプページ (/types) のキャラを動かすためのループ動画を、32体ぶん量産する手順。
1体目 (parakeet_N) は完成・組み込み済み。**このガイドの手順どおりに作れば、
残りは「生成して送る」だけで自動的にページへ反映される。**

表示は「真の透過」方式: 送られた動画は Claude Code 側で背景除去 (Apple Vision) して
アルファ付き動画 (webm + mov) に変換する。静止画 32 枚の透過版
(public/characters/cut/) も同じ方法で処理済み。

## 生成手順 (Kling)

1. **画像から動画 (Image to Video)** を選ぶ
2. **開始フレーム** に対象の静止画 (`public/characters/v3/<slug>.png` のオリジナル) をアップロード
3. **終了フレームにも同じ画像を指定**(ループの継ぎ目対策。最重要)
4. 尺 **5秒**、忠実度(relevance)寄りの設定
5. プロンプトは下の **キャラ別プロンプト** から該当キャラのものをコピー
   (共通の骨格 + そのキャラだけの小さな仕草 1 つ、という構成。トーンを揃えるため文面は変えない)

ネガティブプロンプト (全キャラ共通):

```
camera movement, zoom, pan, background motion, color change,
character deformation, extra limbs
```


## キャラ別プロンプト (32体)

> 骨格はインコ (1本目・成功実績) の文面と完全に同一。主語と「1回だけの仕草」だけ差し替え。

### 空グループ

**1. parakeet_N（詩人）✅ 生成済み** — 実績プロンプト:

```
Subtle idle animation. The felt bird character gently breathes, swaying slightly up and down in place, blinking occasionally, and once waves its wing a little. Camera completely static, no zoom, no pan. Background and all surrounding objects remain perfectly still. Calm, soft, seamless looping motion.
```

**2. eagle_R（賢者）**
```
Subtle idle animation. The felt eagle gently breathes, swaying slightly up and down in place, blinking occasionally, and once nods slowly with quiet dignity. Camera completely static, no zoom, no pan. Background and all surrounding objects remain perfectly still. Calm, soft, seamless looping motion.
```

**3. swallow_N（理論家）**
```
Subtle idle animation. The felt bird gently breathes, swaying slightly up and down in place, blinking occasionally, and once tilts its head curiously toward the astrolabe. Camera completely static, no zoom, no pan. Background and all surrounding objects remain perfectly still. Calm, soft, seamless looping motion.
```

**4. hawk_R（ストラテジスト）**
```
Subtle idle animation. The felt bird gently breathes, swaying slightly up and down in place, blinking occasionally, and once glances thoughtfully to the side. Camera completely static, no zoom, no pan. Background and all surrounding objects remain perfectly still. Calm, soft, seamless looping motion.
```

**5. penguin_N（空想家）**
```
Subtle idle animation. The felt parent penguin gently breathes, swaying slightly up and down in place, blinking occasionally, and once flaps its flippers happily. Camera completely static, no zoom, no pan. Background and all surrounding objects remain perfectly still. The baby penguins remain perfectly still as well. Calm, soft, seamless looping motion.
```

**6. swan_R（表現者）**
```
Subtle idle animation. The felt swan gently breathes, swaying slightly up and down in place, blinking occasionally, and once gracefully stretches its neck. Camera completely static, no zoom, no pan. Background and all surrounding objects remain perfectly still. Calm, soft, seamless looping motion.
```

**7. crow_N（収集家）**
```
Subtle idle animation. The felt crow gently breathes, swaying slightly up and down in place, blinking occasionally, and once spreads its wings a little wider with pride. Camera completely static, no zoom, no pan. Background and all surrounding objects remain perfectly still. Calm, soft, seamless looping motion.
```

**8. pelican_R（職人）**
```
Subtle idle animation. The felt pelican gently breathes, swaying slightly up and down in place, blinking occasionally, and once nods with quiet satisfaction at its craftwork. Camera completely static, no zoom, no pan. Background and all surrounding objects remain perfectly still. Calm, soft, seamless looping motion.
```

### 海グループ

**9. jellyfish_N（寄添者）**
```
Subtle idle animation. The felt jellyfish gently breathes, swaying slightly up and down in place, blinking occasionally, and once tilts its head warmly, its tentacles swaying softly. Camera completely static, no zoom, no pan. Background and all surrounding objects remain perfectly still. The other small characters remain perfectly still as well. Calm, soft, seamless looping motion.
```

**10. dolphin_R（先導者）**
```
Subtle idle animation. The felt orca coach gently breathes, swaying slightly up and down in place, blinking occasionally, and once nods encouragingly like a coach. Camera completely static, no zoom, no pan. Background and all surrounding objects remain perfectly still. The other small characters remain perfectly still as well. Calm, soft, seamless looping motion.
```

**11. swordfish_N（采配者）**
```
Subtle idle animation. The felt knight character gently breathes, swaying slightly up and down in place, blinking occasionally, and once raises its lance slightly with pride. Camera completely static, no zoom, no pan. Background and all surrounding objects remain perfectly still. Calm, soft, seamless looping motion.
```

**12. orca_R（将軍）**
```
Subtle idle animation. The felt orca captain gently breathes, swaying slightly up and down in place, blinking occasionally, and once gazes into the distance like a captain. Camera completely static, no zoom, no pan. Background and all surrounding objects remain perfectly still. The ship remains perfectly still as well. Calm, soft, seamless looping motion.
```

**13. clownfish_N（ジャーナリスト）**
```
Subtle idle animation. The felt clownfish gently breathes, swaying slightly up and down in place, blinking occasionally, and once wiggles its fins happily. Camera completely static, no zoom, no pan. Background and all surrounding objects remain perfectly still. The sea anemone remains perfectly still as well. Calm, soft, seamless looping motion.
```

**14. seal_R（フェススター）**
```
Subtle idle animation. The felt surfer character gently breathes, swaying slightly up and down in place, blinking occasionally, and once raises one flipper in a relaxed greeting. Camera completely static, no zoom, no pan. Background and all surrounding objects remain perfectly still. The waves remain perfectly still as well. Calm, soft, seamless looping motion.
```

**15. octopus_N（弁才家）**
```
Subtle idle animation. The felt octopus teacher gently breathes, swaying slightly up and down in place, blinking occasionally, and once taps the chalk gently near the blackboard. Camera completely static, no zoom, no pan. Background and all surrounding objects remain perfectly still. Calm, soft, seamless looping motion.
```

**16. shark_R（革命家）**
```
Subtle idle animation. The felt shark gently breathes, swaying slightly up and down in place, blinking occasionally, and once nods slowly with quiet authority. Camera completely static, no zoom, no pan. Background and all surrounding objects remain perfectly still. The small fish students remain perfectly still as well. Calm, soft, seamless looping motion.
```

### 陸グループ

**17. rabbit_N（アテンダント）**
```
Subtle idle animation. The felt character gently breathes, swaying slightly up and down in place, blinking occasionally, and once bows politely with a warm smile. Camera completely static, no zoom, no pan. Background and all surrounding objects remain perfectly still. Calm, soft, seamless looping motion.
```

**18. dog_R（幹事）**
```
Subtle idle animation. The felt dog gently breathes, swaying slightly up and down in place, blinking occasionally, and once tilts its head warmly. Camera completely static, no zoom, no pan. Background and all surrounding objects remain perfectly still. Calm, soft, seamless looping motion.
```

**19. elephant_N（師範）**
```
Subtle idle animation. The felt elephant gently breathes, swaying slightly up and down in place, blinking occasionally, and once raises its trunk energetically. Camera completely static, no zoom, no pan. Background and all surrounding objects remain perfectly still. Calm, soft, seamless looping motion.
```

**20. bear_R（支配人）**
```
Subtle idle animation. The felt bear gently breathes, swaying slightly up and down in place, blinking occasionally, and once nods firmly with reassurance. Camera completely static, no zoom, no pan. Background and all surrounding objects remain perfectly still. Calm, soft, seamless looping motion.
```

**21. fox_N（演出家）**
```
Subtle idle animation. The felt magician fox gently breathes, swaying slightly up and down in place, blinking occasionally, and once gives a small theatrical bow. Camera completely static, no zoom, no pan. Background and all surrounding objects remain perfectly still. The dove and the hat remain perfectly still as well. Calm, soft, seamless looping motion.
```

**22. squirrel_R（楽天家）**
```
Subtle idle animation. The felt character gently breathes, swaying slightly up and down in place, blinking occasionally, and once smiles and closes its eyes contentedly. Camera completely static, no zoom, no pan. Background and all surrounding objects remain perfectly still. Calm, soft, seamless looping motion.
```

**23. cheetah_N（開拓者）**
```
Subtle idle animation. The felt cheetah gently breathes, swaying slightly up and down in place, blinking occasionally, and once pumps its fist lightly in triumph. Camera completely static, no zoom, no pan. Background and all surrounding objects remain perfectly still. The trophy remains perfectly still as well. Calm, soft, seamless looping motion.
```

**24. tiger_R（勝負師）**
```
Subtle idle animation. The felt racer tiger gently breathes, swaying slightly up and down in place, blinking occasionally, and once flashes a confident grin. Camera completely static, no zoom, no pan. Background and all surrounding objects remain perfectly still. The race car remains perfectly still as well. Calm, soft, seamless looping motion.
```

### 未知グループ

**25. unicorn_N（夢想家）**
```
Subtle idle animation. The felt unicorn gently breathes, swaying slightly up and down in place, blinking occasionally, and once tosses its mane softly. Camera completely static, no zoom, no pan. Background and all surrounding objects remain perfectly still. The rainbow and the castle remain perfectly still as well. Calm, soft, seamless looping motion.
```

**26. dragon_R（守護者）**
```
Subtle idle animation. The felt dragon gently breathes, swaying slightly up and down in place, blinking occasionally, and once exhales slowly and peacefully with its eyes half closing. Camera completely static, no zoom, no pan. Background and all surrounding objects remain perfectly still. The bonsai remains perfectly still as well. Calm, soft, seamless looping motion.
```

**27. pegasus_N（飛翔家）**
```
Subtle idle animation. The felt pegasus gently breathes, swaying slightly up and down in place, blinking occasionally, and once flutters its wings gently. Camera completely static, no zoom, no pan. Background and all surrounding objects remain perfectly still. The moon and the star remain perfectly still as well. Calm, soft, seamless looping motion.
```

**28. phoenix_R（不屈者）**
```
Subtle idle animation. The felt phoenix gently breathes, swaying slightly up and down in place, blinking occasionally, and once tilts its head, its flame-like feathers flickering very softly. Camera completely static, no zoom, no pan. Background and all surrounding objects remain perfectly still. Calm, soft, seamless looping motion.
```

**29. angel_N（審美者）**
```
Subtle idle animation. The felt angel gently breathes, swaying slightly up and down in place, blinking occasionally, and once flutters its small wings. Camera completely static, no zoom, no pan. Background and all surrounding objects remain perfectly still. The flowers and the watering can remain perfectly still as well. Calm, soft, seamless looping motion.
```

**30. golem_R（数寄者）**
```
Subtle idle animation. The felt stone golem gently breathes, swaying slightly up and down in place, blinking occasionally, and once blinks its glowing eyes very slowly. Camera completely static, no zoom, no pan. Background and all surrounding objects remain perfectly still. The moss and the small bird remain perfectly still as well. Calm, soft, seamless looping motion.
```

**31. ghost_N（探偵）**
```
Subtle idle animation. The felt ghost gently breathes, swaying slightly up and down in place, blinking occasionally, and once peeks shyly to the side while floating gently up and down. Camera completely static, no zoom, no pan. Background and all surrounding objects remain perfectly still. The desk and the screens remain perfectly still as well. Calm, soft, seamless looping motion.
```

**32. skeleton_R（風雲児）**
```
Subtle idle animation. The felt skeleton gently breathes, swaying slightly up and down in place, blinking occasionally, and once yawns in a relaxed way while the hammock sways very slightly with it. Camera completely static, no zoom, no pan. Background and all surrounding objects remain perfectly still. Calm, soft, seamless looping motion.
```

## 合格チェック (生成後に見る4点)

1. 背景色が一瞬も変わらない・暗転しない
2. リピート再生で継ぎ目がカクつかない
3. 動きの途中でキャラの顔・毛の質感が崩れない
4. カメラが勝手にズームしていない

## 納品 → 反映の流れ

- 生成した mp4 を、**どのキャラか分かる状態で** Claude Code に渡す (数本ずつで OK)
- Claude Code 側で加工して配置する (全自動・ローカル完結):
  1. 往復ループ化 (継ぎ目消し) + 640px 化 → フレーム連番に展開
  2. Apple Vision (`/tmp/vision/removebg_batch`) で全フレームの背景除去
     — 色抜きと違い淡色部が抜けず、Kling のウォーターマークも背景ごと消える
  3. アルファ付きで 2 形式にエンコード:
     - `<slug>.webm` VP9+alpha (`-c:v libvpx-vp9 -pix_fmt yuva420p -crf 34`)
     - `<slug>.mov` HEVC+alpha (`-c:v hevc_videotoolbox -allow_sw 1 -alpha_quality 0.75 -tag:v hvc1`) … Safari/iOS 用
  4. `public/characters/motion/` に配置 → **置くだけで /types に自動反映**
     (ページがビルド時にディレクトリを走査するため、コード変更は不要)
- 透過するため、生成物の背景色ズレはもう問題にならない。ただし背景が
  ゴチャつくと切り抜き精度が落ちるので、**背景と小物が動かないこと**は引き続き重要

## ⚠️ 取り違え注意

ファイル名の slug と二つ名の動物は、キャラ改版の経緯で**一致しないものがある**
(例: slug `fox_N` の中身はキツネの手品師だが、データ上の二つ名は旧称「にこにこパンダ」)。
**必ず下表の「元画像」を入力に使い、出力も同じ slug で扱うこと。**
見た目の動物名でファイルを探さない。

## チェックリスト (32体)

| # | 状態 | slug (元画像 = v3/<slug>.png) | 二つ名 | 肩書き | グループ |
|---|---|---|---|---|---|
| 1 | ✅ 完了 | parakeet_N | きらめきインコ | 詩人 | 空 |
| 2 | ⬜ | eagle_R | どうどうワシ | 賢者 | 空 |
| 3 | ⬜ | swallow_N | すいすいツバメ | 理論家 | 空 |
| 4 | ⬜ | hawk_R | クールタカ | ストラテジスト | 空 |
| 5 | ⬜ | penguin_N | なかよしペンギン | 空想家 | 空 |
| 6 | ⬜ | swan_R | ゆうがハクチョウ | 表現者 | 空 |
| 7 | ⬜ | crow_N | きまぐれカラス | 収集家 | 空 |
| 8 | ⬜ | pelican_R | おおらかペリカン | 職人 | 空 |
| 9 | ⬜ | jellyfish_N | きらめきイルカ | 寄添者 | 海 |
| 10 | ⬜ | dolphin_R | れいせいシャチ | 先導者 | 海 |
| 11 | ⬜ | swordfish_N | やさしいタツノオトシゴ | 采配者 | 海 |
| 12 | ⬜ | orca_R | ゆうゆうウミガメ | 将軍 | 海 |
| 13 | ⬜ | clownfish_N | ゆめみるクラゲ | ジャーナリスト | 海 |
| 14 | ⬜ | seal_R | のんびりマンボウ | フェススター | 海 |
| 15 | ⬜ | octopus_N | きままクマノミ | 弁才家 | 海 |
| 16 | ⬜ | shark_R | マイペースサメ | 革命家 | 海 |
| 17 | ⬜ | rabbit_N | せわやきイヌ | アテンダント | 陸 |
| 18 | ⬜ | dog_R | たよれるウマ | 幹事 | 陸 |
| 19 | ⬜ | elephant_N | がんばりトラ | 師範 | 陸 |
| 20 | ⬜ | bear_R | どっしりクマ | 支配人 | 陸 |
| 21 | ⬜ | fox_N | にこにこパンダ | 演出家 | 陸 |
| 22 | ⬜ | squirrel_R | おっとりゾウ | 楽天家 | 陸 |
| 23 | ⬜ | cheetah_N | やんちゃアライグマ | 開拓者 | 陸 |
| 24 | ⬜ | tiger_R | ごうかいサイ | 勝負師 | 陸 |
| 25 | ⬜ | unicorn_N | じゅんすいユニコーン | 夢想家 | 未知 |
| 26 | ⬜ | dragon_R | ゆるぎないドラゴン | 守護者 | 未知 |
| 27 | ⬜ | pegasus_N | あこがれペガサス | 飛翔家 | 未知 |
| 28 | ⬜ | phoenix_R | ふくつのフェニックス | 不屈者 | 未知 |
| 29 | ⬜ | angel_N | おもいやりエンジェル | 審美者 | 未知 |
| 30 | ⬜ | golem_R | ふどうゴーレム | 数寄者 | 未知 |
| 31 | ⬜ | ghost_N | てれやオバケ | 探偵 | 未知 |
| 32 | ⬜ | skeleton_R | のんきガイコツ | 風雲児 | 未知 |
