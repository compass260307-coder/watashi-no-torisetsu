import type { Article } from "../articles";

// 診断結果（5つの得点とタイプ）の読み方を、信頼性・妥当性の基礎から整理する。構成と文体は src/lib/articles.ts 冒頭の執筆ルールに従う。
export const article: Article = {
  slug: "ocean-kekka-yomikata",
  title:
    "性格診断の結果とは何か：得点の意味、測定の誤差、および読み方の限界",
  listTitle: "診断結果とは何か：得点・誤差・読み方",
  description:
    "性格診断の結果（5つの得点とタイプ）の読み方を、研究にもとづいて整理します。得点は何の数値なのか、どのくらいの差に意味があるのか、「当たっている」と感じることは根拠になるのか。信頼性と妥当性の基礎から、中間の得点の意味、してはいけない読み方、友達の評価と並べて読む理由までを扱います。",
  category: "基礎知識",
  published: "2026-11-09",
  updated: "2026-11-26",
  image: "/article-covers/ocean-kekka-yomikata-scene.webp",
  imageAlt: "緑の上着を着たクマが机でスコアのグラフを見ながらメモを取っている",
  abstract: [
    "性格診断の結果は、数値とタイプの形で示される。数値は客観的な事実のように見えるが、その実体は、質問への回答を一定の規則で集計したものである。身長や体重のような物理量とは性質が異なり、誤差を含み、回答の仕方に由来する偏りを含む。",
    "本稿では、得点が何を表す数値であるか、信頼性と測定の誤差、妥当性と「当たっている」という感覚の区別、自己評価に入り込む偏り、中間の得点の意味、5つの得点の組み合わせとしての読み方、タイプの境界、時間的な変化、効果の大きさを順に整理する。そのうえで、結果の読み方として避けるべきものを挙げ、本診断の結果がどの範囲のことを述べているのかを明示する。",
  ],
  lead: [
    "診断結果を受け取った人は、多くの場合、最も高い得点やタイプの名称に目を向け、それが自分に合っているかどうかを確かめようとする。この読み方は自然であるが、結果に含まれる情報の一部しか用いておらず、また、合っているという感覚が何を意味するのかを問うていない。",
    "本稿の問いは3つである。第1に、得点は何の数値なのか。第2に、その数値はどの程度まで信頼でき、どのくらいの差に意味があるのか。第3に、結果はどう読むのが妥当であり、どう読むべきではないのか。以下、各節で研究上の知見を示し、最後に本診断との対応を述べる。",
  ],
  sections: [
    {
      heading: "1. 得点は何の数値か",
      paragraphs: [
        "性格の得点は、複数の質問に対する「当てはまる」「当てはまらない」といった回答を数値に置き換え、平均または合計したものである。したがって得点が直接に表しているのは、回答者が自分についてどう答えたかであって、行動を観察して数えた結果ではない。",
        "この回答には、暗黙の比較が含まれている。「人と話すのが好きだ」という文にどの程度当てはまるかを判断するとき、回答者は、自分の知る人々を基準として自分の位置を見積もっている。Heine ら（2002）は、この基準となる集団が回答者によって異なることを指摘し、準拠集団効果と呼んだ。得点は絶対的な量ではなく、回答者が想定した周囲の人々に対する相対的な位置を含んでいる。",
        "また、得点は、その人が常にとる行動を表すものでもない。Fleeson（2001）は、日常の行動を繰り返し記録する方法によって、1人の人が各特性のほぼすべての水準の行動を示すことを明らかにし、特性を行動の分布として捉えることを提案した。この見方に立てば、得点は分布の中心のおおよその位置を表す。外向性の得点が高い人も静かに過ごす時間を持ち、低い人も活発に振る舞う場面を持つ。得点と合わない行動の記憶があることは、得点が誤っていることを意味しない。",
      ],
    },
    {
      heading: "2. 信頼性：同じ結果が再び得られるか",
      paragraphs: [
        "測定の質を評価する第1の観点は、信頼性である。信頼性とは、測定が一貫した結果を与える程度を指す。信頼性には、性質の異なる2つの見方がある。",
        "1つは、内的一貫性である。同じ特性を測るはずの項目どうしが、互いに似た回答を得ているかを見る。Cronbach（1951）のα係数は、その代表的な指標である。もう1つは、再検査信頼性である。同じ人が期間をおいて再び回答したとき、得点がどの程度一致するかを見る。",
        "この2つは同じものではない。McCrae ら（2011）は、3万4千人を超える回答者のデータを用いて、性格検査の下位尺度の信頼性と妥当性の関係を検討した。その結果、尺度の妥当性を予測したのは再検査信頼性であり、内的一貫性ではなかった。この研究で用いられた検査では、1週間をおいた再検査の相関の中央値は .83 であった。Viswesvaran & Ones（2000）は、5因子を測るさまざまな尺度について報告された値を集計し、再検査による安定性の係数の平均が、因子によって .69 から .76 であったとしている。",
        "これらの値は、性格の得点がかなり安定していることと、完全には一致しないことの両方を示している。同じ人が2回答えれば、得点はおおむね近い値になるが、同じ値にはならない。",
      ],
    },
    {
      heading: "2.1 誤差の幅と小さな差",
      paragraphs: [
        "測定の理論では、観測された得点を、その人の真の値と誤差の和として考える。誤差は、その日の気分、質問文の読み取り方、回答の際の注意の向け方などから生じ、得点を上にも下にも動かす。得点は1つの点としてではなく、ある幅を持つものとして読む必要がある。",
        "誤差の幅は、項目数が少ないほど大きくなる。Credé ら（2012）は、ごく少数の項目で性格を測る短い尺度の帰結を検討し、こうした尺度を用いると、性格特性が結果に対して果たす役割が大幅に過小評価されうることを示した。著者らは、項目をわずかに増やすだけで妥当性が改善することも指摘している。",
        "ここから、得点の読み方について2つのことが導かれる。第1に、小さな差に意味を読み込むべきではない。2つの因子の得点が数ポイント違うとき、その順序は、再度の回答で入れ替わりうる。2つの得点の差は、それぞれの誤差を両方とも含むため、単独の得点よりもさらに不確かである。第2に、尺度の端に近い得点と中央付近の得点の違いのような大きな差は、誤差によって逆転する可能性が低い。結果のうち信頼して読めるのは、細かな順位ではなく、大まかな高低の配置である。",
      ],
    },
    {
      heading: "3. 妥当性：測ろうとしたものを測っているか",
      paragraphs: [
        "第2の観点は、妥当性である。得点が安定していても、それが測ろうとした特性を反映しているとは限らない。体重計が毎回同じ値を示しても、その値が身長を表すわけではないのと同じである。",
        "性格のように直接に観察できない特性については、妥当性を1つの基準との照合によって確かめることができない。Cronbach & Meehl（1955）は、この問題に対して構成概念妥当性という考え方を提示した。理論から予想される多数の関係が実際に成り立つかどうかを積み重ねて検討する、という立場である。Campbell & Fiske（1959）は、その具体的な方法として、同じ特性を異なる方法で測った結果が一致すること（収束）と、異なる特性を測った結果が区別されること（弁別）の両方を確かめる枠組みを示した。単一の方法による測定だけでは、妥当性は確かめられない。",
        "現在の標準的な考え方では、妥当性は検査そのものの性質ではなく、得点の解釈と用途についての性質とされる（AERA ら, 2014）。同じ得点であっても、自己理解の手がかりとして読むことには根拠があり、別の目的に用いることには根拠がない、ということがありうる。この点は第10節で再び扱う。",
      ],
    },
    {
      heading: "4. 「当たっている」という感覚",
      paragraphs: [
        "結果を読んで「当たっている」と感じることは、妥当性の証拠のように思われる。しかし、この感覚は妥当性とは別のものである。Forer（1949）は、性格検査を受けた学生全員に同一の文章を結果として渡し、学生たちがそれを自分によく当てはまると評定したことを報告した。",
        "Dickson & Kelly（1985）は、その後の研究を概観し、誰にでも当てはまる一般的な記述が受け入れられる程度は、その記述が自分に関係するものとして示されているか、また内容が好意的であるかによって左右されると整理している。つまり、納得感は、記述の正確さだけでなく、記述の示され方と内容の好ましさによっても高まる。",
        "この知見は、結果を読む際の具体的な手がかりになる。ある記述に納得したときには、その記述が自分と他の人を区別しているかどうかを確かめるとよい。反対の内容の記述を示されても同じように納得したであろう場合、その記述は自分についての情報をほとんど含んでいない。5つの得点は、高い側と低い側とで異なる記述に対応するという点で、誰にでも当てはまる文章とは構造が異なる。ただし、得点に添えられた説明文をどの程度自分に固有のものとして受け取るかについては、同じ注意が必要である。",
      ],
    },
    {
      heading: "5. 自己評価に入り込む偏り",
      paragraphs: [
        "自己評価による得点には、偶然の誤差とは別に、一定の方向を持つ偏りが入り込む。偶然の誤差は項目を増やせば打ち消し合うが、偏りは打ち消し合わない。代表的なものは次の3つである。",
      ],
      list: [
        {
          term: "社会的望ましさ",
          body: "望ましいとされる方向に回答が寄る傾向。Paulhus（1984）は、これが2つの成分に分かれることを示した。他者に良い印象を与えようとする印象操作と、本人が実際にそう信じている自己欺瞞である。前者は匿名の回答では弱まるが、後者は本人にも気づかれにくい。",
        },
        {
          term: "黙従傾向",
          body: "質問の内容にかかわらず「当てはまる」と答えやすい傾向。Soto ら（2008）は、10歳から20歳の回答者を分析し、この傾向の個人差が若い年齢ほど大きく、得点の性質に強く影響することを示した。肯定すると得点が上がる項目と下がる項目（逆転項目）を混ぜることは、この偏りを抑えるための方法である。",
        },
        {
          term: "準拠集団効果",
          body: "第1節で述べたとおり、回答者は自分の周囲の人々を基準に回答する（Heine ら, 2002）。活発な人の多い環境にいる人は、自分の外向性を低めに見積もりやすい。環境が変わると、行動が同じでも得点が変わりうる。",
        },
      ],
    },
    {
      heading: "6. 中間の得点",
      paragraphs: [
        "得点が尺度の中央付近にあるとき、結果は特徴に乏しく見える。しかし、中間の得点は、情報がないことを意味しない。",
        "第1に、中間は最も一般的な位置である。性格特性の大半は、類型ではなく連続的な次元として分布する（Haslam ら, 2012）。人々は高い群と低い群に分かれているのではなく、多くの人が中央の近くに位置している。",
        "第2に、中間の得点は、状況によって行動が変わることを反映している可能性がある。Kulas & Stachowski（2009）は、性格項目に対する中間の選択肢への回答を分析し、それが「場合による」という意味合いを持つこと、回答に時間がかかること、項目の内容が明確でないほど選ばれやすいことを報告した。中間の回答は、特性の程度が中くらいであることのほかに、場面を特定しなければ答えられないという判断も含んでいる。",
        "第3に、中間の得点は、内訳の異なる複数の場合を含む。1つの因子が複数の下位特性から成るとき、下位特性がいずれも中間である場合と、一方が高く他方が低い場合とは、因子の得点としては同じ値になる。中間の得点を持つ2人が、似た人物であるとは限らない。",
      ],
    },
    {
      heading: "7. 5つの得点の組み合わせとして読む",
      paragraphs: [
        "5つの因子は、互いにおおむね独立した次元として得られたものである。したがって、ある因子の得点から、別の因子の得点を推し量ることはできない。結果は、最も高い1つの因子によってではなく、5つの得点の配置の全体によって読むのが適切である。",
        "同じ因子の得点も、他の因子との組み合わせによって、行動への現れ方が異なると考えられる。外向性が高く協調性も高い人と、外向性が高く協調性が低い人とでは、人との関わり方の記述は異なるであろう。ただし、組み合わせの読み方には留保が必要である。Asendorpf（2003）は、5因子の得点の組み合わせにもとづく類型と、連続的な得点そのものとで予測力を比較し、多くの場合に後者が優れ、組み合わせが独自に付け加える予測力はごく限られることを報告した。組み合わせは、5つの得点を要約して記述するための手段であり、個々の得点を超える新しい情報を生み出すものとは言えない。",
        "得点は、因子より下の水準でも読むことができる。DeYoung ら（2007）は、5因子のそれぞれが2つの側面に分かれることを示し、Soto & John（2017）は、下位特性を区別することで記述の細かさと予測力が高まることを示した。因子の得点が同じ2人が、下位の水準では異なる配置を持つことは珍しくない。",
      ],
    },
    {
      heading: "8. タイプの境界",
      paragraphs: [
        "タイプは、連続的な得点をある点で区切り、その組み合わせに名称を与えたものである。MacCallum ら（2002）は、量的な変数を2つに区切る操作を検討し、同じ側に入った人々の間の違いが無視されること、境界をはさんで隣り合う人々が異なるものとして扱われることを、この操作に伴う問題として挙げた。",
        "結果の読み方としては、次のことが言える。得点が境界から離れている因子については、タイプの示す高低は安定した記述である。得点が境界に近い因子については、タイプの示す高低は、再度の回答で入れ替わりうる。第2.1節で述べた誤差の幅が、境界をまたぐからである。タイプは結果の全体を1語で表す要約として読み、個々の因子については得点を参照するのがよい。",
      ],
    },
    {
      heading: "9. 得点の時間的な変化と、効果の大きさ",
      paragraphs: [
        "結果は、回答した時点の記録である。Roberts & DelVecchio（2000）は152の縦断研究を統合し、集団内での相対的な順位の安定性が、大学生の時期で .54、30歳で .64、50歳以降でおよそ .74 であることを示した。Roberts ら（2006）は、集団の平均値も成人期を通じて変化し続けることを示している。性格の得点は、数年という単位では、安定しつつも変化する。",
        "一方、数日から数週間という短い間隔での得点の違いは、性格の変化よりも、第2節で述べた測定の誤差を主に反映すると考えるのが妥当である。再度の回答で得点が少し動いたことを、自分が変わった証拠として読むことはできない。",
        "得点が何を予測するかについても、大きさの感覚を持っておく必要がある。Mischel（1968）は、質問紙による性格の測定値と行動などの外部の基準との相関が、.20 から .30 程度にとどまることを指摘した。Funder & Ozer（2019）は、心理学の研究における効果の大きさの評価を論じ、.40 以上の相関は過大な推定である可能性が高いと述べる一方、小さな効果も、多数の人々や繰り返される場面にわたって積み重なれば、実質的な意味を持ちうるとした。性格の得点は、多数の人々についての平均的な傾向を述べることができるが、1人の人の特定の場面での行動を言い当てるものではない。",
      ],
    },
    {
      heading: "10. 避けるべき読み方",
      paragraphs: [
        "以上を踏まえると、結果の読み方のうち、根拠を欠くものを特定できる。",
      ],
      list: [
        {
          term: "優劣として読む",
          body: "得点は位置を示すものであり、評価を示すものではない。いずれの因子についても、高い側と低い側のそれぞれに、適した環境と適さない環境がある。",
        },
        {
          term: "固定されたものとして読む",
          body: "得点は、その時点における位置である。Chiu ら（1997）は、人の特性を固定的なものと考える人ほど、わずかな行動から特性を強く推論し、将来の行動を特性から強く予測する傾向があることを示した。結果を変わらない本質として読むことは、行動の幅と変化の可能性を見落とすことにつながる。",
        },
        {
          term: "他者へのラベルとして用いる",
          body: "得点やタイプは、本人の回答から得られた本人についての要約である。行動の観察だけから他者の得点やタイプを推定して当てはめることは、測定ではない。また、タイプを理由として相手の行動を説明することは、記述と原因を取り違えている。",
        },
        {
          term: "採用や選抜に用いる",
          body: "Viswesvaran & Ones（1999）は、指示されれば回答者が性格検査の得点を望ましい方向に動かせること、その動かしやすさが5因子の間で変わらないことをメタ分析によって示した。Morgeson ら（2007）は、自己報告式の性格検査を人事選抜に用いることについて、職務成績に対する予測力の低さを理由に再考を促している。この主張には反論もあり議論は続いているが、少なくとも、自己理解のために作られた診断の結果を、他者が人を選ぶ目的に用いることには根拠がない。",
        },
      ],
    },
    {
      heading: "11. 友達の評価と並べて読む",
      paragraphs: [
        "第3節で述べたとおり、妥当性は、異なる方法による測定が一致するかどうかによって確かめられる。自己評価に対する最も身近な「異なる方法」は、その人をよく知る他者による評価である。",
        "Vazire（2010）は、自己と他者のどちらが正確であるかは特性によって異なることを示した。内面の感情のように外から見えにくい特性では自己評価が、評価的な意味合いの強い特性では他者評価が、より正確であった。Connelly & Ones（2010）は、他者評価が行動を予測する力を持つこと、その正確さが相手との親密さに依存することを、メタ分析によって示している。",
        "したがって、自己評価と他者評価が一致する因子については、得点の妥当性を支える根拠が1つ加わる。一致しない因子については、どちらかが誤りであると直ちに結論することはできない。第5節で挙げた偏りが自己評価の側に働いている可能性と、他者がその特性を観察する機会を持たなかった可能性の両方がある。不一致は、その因子について確かめる価値があることを示す情報として読むのが適切である。",
      ],
    },
    {
      heading: "12. 本診断との対応",
      paragraphs: [
        "本診断の自己診断は50問であり、5因子のそれぞれを2つの小項目、計10の小項目で測定する。回答は7段階であり、項目は具体的な場面での行動を問う形式をとっている。一部は逆転項目であり、第5節で述べた黙従傾向の影響を抑える働きを持つ。各小項目の得点は5問の平均から、各因子の得点は2つの小項目から算出される。",
        "結果の画面では、各因子について、尺度の両端のどちらの側にどの程度寄っているかが百分率で示される。この数値は尺度の上での位置を表すものであり、回答者全体の中での順位を表す値ではない。たとえば70%という表示は、その側に寄っていることを示すが、回答者の上位3割に入ることを意味しない。数値の1ポイント単位の違いを読み込むべきでない理由は、第2.1節で述べた誤差にある。",
        "32のタイプは、5つの因子のそれぞれを尺度の中点で高低に2分した組み合わせである。第8節で述べたとおり、中点に近い因子については、再度の回答でタイプが変わりうる。",
        "友達診断は、同じ10の小項目について、各3問、計30問で友達による評価を得て、自己評価との差を示す。第11節で述べた、異なる方法による照合にあたる。ただし、小項目あたりの項目数は自己診断より少なく、評価する友達の人数も限られるため、差の大きさには自己診断の得点以上の誤差が含まれる。",
      ],
    },
    {
      heading: "13. 限界",
      paragraphs: [
        "本診断の結果を読む際には、以下の点に留意されたい。",
      ],
      list: [
        {
          term: "本診断そのものの信頼性",
          body: "本稿で引用した信頼性の値は、他の尺度について報告されたものである。本診断の項目について、内的一貫性や再検査信頼性を検証した結果は、本稿では示していない。",
        },
        {
          term: "項目数と誤差",
          body: "各小項目は5問、友達診断では3問である。研究用の長い尺度と比べて、得点の誤差は大きい。",
        },
        {
          term: "基準となる集団がないこと",
          body: "示される数値は尺度の上での位置であり、特定の集団の中での順位に換算されていない。数値の高低を、他の検査の結果や統計上の平均と直接に比べることはできない。",
        },
        {
          term: "自己認識への依存",
          body: "得点は回答時点の自己認識を反映し、社会的望ましさ、黙従傾向、準拠集団の影響を受ける。逆転項目はこれらの一部を抑えるにとどまる。",
        },
        {
          term: "説明文の読まれ方",
          body: "得点やタイプに添えられた文章は、一般的な記述を含む。納得できることは、結果が正しいことの根拠にならない。",
        },
        {
          term: "集団の知見と個人",
          body: "引用した知見は、いずれも集団における平均的な傾向である。個人の適性や将来を予測するものではない。",
        },
        {
          term: "優劣",
          body: "いずれの因子についても、得点の高低に優劣はない。",
        },
      ],
    },
    {
      heading: "14. 結論",
      paragraphs: [
        "冒頭の3つの問いに答える。",
        "第1に、得点は、質問への回答を集計した数値である。回答者が想定した周囲の人々に対する相対的な位置を含み、その人の行動の分布の中心がおおよそどこにあるかを表す。物理量のような絶対的な値ではなく、行動を観察して得た値でもない。",
        "第2に、性格の得点は、短い期間であれば再度の測定でおおむね近い値をとるが、完全には一致しない。信頼して読めるのは、5つの得点の大まかな高低の配置であり、数ポイントの差や、近接した得点の順位ではない。中点に近い因子については、タイプの示す高低も確定したものではない。",
        "第3に、結果は、5つの得点の配置の全体として、その時点における自己認識の要約として読むのが妥当である。優劣、固定された本質、他者に貼るラベル、人を選ぶための基準として読むことには根拠がない。",
        "診断結果は、自分についての答えではなく、確かめるべき仮説の一覧である。納得できたかどうかによってではなく、日々の行動や、自分をよく知る他者の見方と照らし合わせることによって、その仮説は確かめられる。",
      ],
    },
  ],
  references: [
    "American Educational Research Association, American Psychological Association, & National Council on Measurement in Education. (2014). Standards for educational and psychological testing. American Educational Research Association.",
    "Asendorpf, J. B. (2003). Head-to-head comparison of the predictive validity of personality types and dimensions. European Journal of Personality, 17, 327–346.",
    "Campbell, D. T., & Fiske, D. W. (1959). Convergent and discriminant validation by the multitrait-multimethod matrix. Psychological Bulletin, 56(2), 81–105.",
    "Chiu, C., Hong, Y., & Dweck, C. S. (1997). Lay dispositionism and implicit theories of personality. Journal of Personality and Social Psychology, 73(1), 19–30.",
    "Connelly, B. S., & Ones, D. S. (2010). An other perspective on personality: Meta-analytic integration of observers' accuracy and predictive validity. Psychological Bulletin, 136(6), 1092–1122.",
    "Credé, M., Harms, P., Niehorster, S., & Gaye-Valentine, A. (2012). An evaluation of the consequences of using short measures of the Big Five personality traits. Journal of Personality and Social Psychology, 102(4), 874–888.",
    "Cronbach, L. J. (1951). Coefficient alpha and the internal structure of tests. Psychometrika, 16(3), 297–334.",
    "Cronbach, L. J., & Meehl, P. E. (1955). Construct validity in psychological tests. Psychological Bulletin, 52(4), 281–302.",
    "DeYoung, C. G., Quilty, L. C., & Peterson, J. B. (2007). Between facets and domains: 10 aspects of the Big Five. Journal of Personality and Social Psychology, 93(5), 880–896.",
    "Dickson, D. H., & Kelly, I. W. (1985). The “Barnum effect” in personality assessment: A review of the literature. Psychological Reports, 57(2), 367–382.",
    "Fleeson, W. (2001). Toward a structure- and process-integrated view of personality: Traits as density distributions of states. Journal of Personality and Social Psychology, 80(6), 1011–1027.",
    "Forer, B. R. (1949). The fallacy of personal validation: A classroom demonstration of gullibility. Journal of Abnormal and Social Psychology, 44(1), 118–123.",
    "Funder, D. C., & Ozer, D. J. (2019). Evaluating effect size in psychological research: Sense and nonsense. Advances in Methods and Practices in Psychological Science, 2(2), 156–168.",
    "Haslam, N., Holland, E., & Kuppens, P. (2012). Categories versus dimensions in personality and psychopathology: A quantitative review of taxometric research. Psychological Medicine, 42(5), 903–920.",
    "Heine, S. J., Lehman, D. R., Peng, K., & Greenholtz, J. (2002). What's wrong with cross-cultural comparisons of subjective Likert scales?: The reference-group effect. Journal of Personality and Social Psychology, 82(6), 903–918.",
    "Kulas, J. T., & Stachowski, A. A. (2009). Middle category endorsement in odd-numbered Likert response scales: Associated item characteristics, cognitive demands, and preferred meanings. Journal of Research in Personality, 43(3), 489–493.",
    "MacCallum, R. C., Zhang, S., Preacher, K. J., & Rucker, D. D. (2002). On the practice of dichotomization of quantitative variables. Psychological Methods, 7(1), 19–40.",
    "McCrae, R. R., Kurtz, J. E., Yamagata, S., & Terracciano, A. (2011). Internal consistency, retest reliability, and their implications for personality scale validity. Personality and Social Psychology Review, 15(1), 28–50.",
    "Mischel, W. (1968). Personality and assessment. Wiley.",
    "Morgeson, F. P., Campion, M. A., Dipboye, R. L., Hollenbeck, J. R., Murphy, K., & Schmitt, N. (2007). Reconsidering the use of personality tests in personnel selection contexts. Personnel Psychology, 60(3), 683–729.",
    "Paulhus, D. L. (1984). Two-component models of socially desirable responding. Journal of Personality and Social Psychology, 46(3), 598–609.",
    "Roberts, B. W., & DelVecchio, W. F. (2000). The rank-order consistency of personality traits from childhood to old age: A quantitative review of longitudinal studies. Psychological Bulletin, 126(1), 3–25.",
    "Roberts, B. W., Walton, K. E., & Viechtbauer, W. (2006). Patterns of mean-level change in personality traits across the life course: A meta-analysis of longitudinal studies. Psychological Bulletin, 132(1), 1–25.",
    "Soto, C. J., & John, O. P. (2017). The next Big Five Inventory (BFI-2): Developing and assessing a hierarchical model with 15 facets to enhance bandwidth, fidelity, and predictive power. Journal of Personality and Social Psychology, 113(1), 117–143.",
    "Soto, C. J., John, O. P., Gosling, S. D., & Potter, J. (2008). The developmental psychometrics of Big Five self-reports: Acquiescence, factor structure, coherence, and differentiation from ages 10 to 20. Journal of Personality and Social Psychology, 94(4), 718–737.",
    "Vazire, S. (2010). Who knows what about a person? The self–other knowledge asymmetry (SOKA) model. Journal of Personality and Social Psychology, 98(2), 281–300.",
    "Viswesvaran, C., & Ones, D. S. (1999). Meta-analyses of fakability estimates: Implications for personality measurement. Educational and Psychological Measurement, 59(2), 197–210.",
    "Viswesvaran, C., & Ones, D. S. (2000). Measurement error in “Big Five factors” personality assessment: Reliability generalization across studies and measures. Educational and Psychological Measurement, 60(2), 224–235.",
  ],
};
