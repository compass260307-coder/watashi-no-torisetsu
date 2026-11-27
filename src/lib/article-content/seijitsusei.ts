import type { Article } from "../articles";

// 誠実性（Conscientiousness）の定義・構造・成果や健康との関連・測定。構成と文体は src/lib/articles.ts 冒頭の執筆ルールに従う。
export const article: Article = {
  slug: "seijitsusei",
  title: "誠実性とは何か：定義、構造、成果・健康との関連、および測定",
  listTitle: "誠実性とは何か：定義・構造・測定",
  description:
    "ビッグファイブの誠実性（Conscientiousness）を、研究にもとづいて整理します。名称の注意点、下位構造、学業や仕事の成果・健康や寿命との関連、自己統制やグリットとの重なり、年齢による変化、高いほどよいのかという議論を扱います。この診断が測っている範囲と限界も示します。",
  category: "基礎知識",
  published: "2026-07-21",
  updated: "2026-11-26",
  image: "/article-covers/seijitsusei-scene.webp",
  imageAlt: "緑のジャケットを着たクマがチェックリストを確認しながら机で積み木を組み立てている",
  abstract: [
    "誠実性（Conscientiousness）は、ビッグファイブを構成する5因子の1つである。日本語の「誠実」が連想させる正直さを指すのではなく、目標に向けて努力し、物事を秩序立て、衝動を抑え、責任を果たす傾向の個人差を指す。5因子の中で、学業、職業、健康に関する結果との関連が最も多く報告されてきた因子である。",
    "本稿では、誠実性の名称と定義、下位構造、行動としての現れ方、学業成績および職業上の成果との関連、健康行動と寿命との関連、自己統制やグリットとの概念の重なり、年齢による変化、高い誠実性をめぐる議論、文化と測定の問題、自己評価と他者評価の関係を順に整理する。そのうえで、本診断が誠実性のどの範囲を測定しているのか、また何を測定していないのかを明示する。",
  ],
  lead: [
    "誠実性は、5因子の中で「高いほうがよい」と理解されやすい因子である。計画的で勤勉であることは、多くの社会で望ましいとされる。実際、後述するとおり、誠実性は多くの望ましい結果と関連する。しかし、関連があることと、高いほど望ましいと言えることは、別の問題である。",
    "本稿の問いは3つである。第1に、誠実性は何を測っているのか。第2に、誠実性と成果や健康との関連は、個人についてどこまでのことを述べられるのか。第3に、誠実性は高いほど望ましいと言えるのか。以下、各節で研究上の知見を示し、最後に本診断との対応を述べる。",
  ],
  sections: [
    {
      heading: "1. 名称と定義",
      paragraphs: [
        "誠実性の原語である Conscientiousness は、日常の日本語の「誠実」とは意味が異なる。日本語の「誠実」は、うそをつかないこと、他者に対して真心があることを指す。これに対して Conscientiousness は、物事を入念に行うこと、勤勉であること、自分を律することを指す。このずれを避けるため、「勤勉性」と訳されることもある。",
        "正直さや公正さは、5因子の枠組みでは独立した因子として扱われていない。Ashton & Lee（2007）の HEXACO モデルは、これを「正直さ・謙虚さ」という第6の因子として立てている。この立場からは、誠実性と正直さは別の次元であり、勤勉で計画的だが正直さは高くない人も、正直だが計画的ではない人も想定される。",
        "Roberts ら（2014）は、誠実性の概念、下位の次元、ほかの概念との関係を整理し、誠実性を、健康、加齢、人的資本に関わる中核的な要因と位置づけた。同時に、この論文は、誠実性が単一の特性ではなく、上位と下位の概念からなる階層として理解されるべきであると論じている。その階層の内容を次節で扱う。",
      ],
    },
    {
      heading: "2. 下位構造",
      paragraphs: [
        "誠実性をどのような下位特性に分けるかは、尺度によって異なる。主な分類は次のとおりである。",
      ],
      list: [
        {
          term: "6つの下位特性（NEO-PI-R）",
          body: "Costa & McCrae（1992）は、誠実性をコンピテンス、秩序、良心性、達成追求、自己鍛錬、慎重さの6つから構成した。最も細かい分類の1つであり、長く標準として用いられてきた。",
        },
        {
          term: "2つの側面（DeYoung ら, 2007）",
          body: "DeYoung らは75の下位尺度を因子分析し、各因子が2つの側面に分かれることを示した。誠実性の場合は「勤勉さ」と「秩序性」である。前者は目標に向けた努力の持続に、後者は整理や手順へのこだわりに対応する。",
        },
        {
          term: "3つの下位特性（BFI-2）",
          body: "Soto & John（2017）の BFI-2 は、誠実性を秩序性、生産性、責任感の3つで測定する。",
        },
        {
          term: "6つの因子（Roberts ら, 2005）",
          body: "Roberts らは、7つの主要な性格検査に含まれる誠実性に関連する36の尺度を、737人の標本で分析した。得られたのは、勤勉さ、秩序、自己統制、責任感、伝統性、徳の6因子からなる階層構造であった。",
        },
      ],
    },
    {
      heading: "2.1 下位構造から分かること",
      paragraphs: [
        "4つの分類を比較すると、2点が指摘できる。第1に、誠実性をいくつに分けるかについて、単一の合意は存在しない。Roberts ら（2005）の分析は、既存の検査がそれぞれ誠実性の異なる部分を重点的に測定していることも示している。第2に、それにもかかわらず、努力の持続に関わる部分と、秩序に関わる部分は、いずれの分類にも共通して現れる。",
        "この構造は、同じ誠実性の得点を持つ2人が、内実としては異なる人物でありうることを意味する。高い目標を掲げて努力を続けるが身の回りの整理には関心が薄い人と、整理や段取りを重んじるが高い目標は求めない人は、合計すれば近い得点になりうる。誠実性を1つの数値としてのみ読むと、この違いは失われる。",
      ],
    },
    {
      heading: "3. 行動としての誠実性",
      paragraphs: [
        "誠実性の高い人は、具体的に何をしているのか。この問いは、特性を形容詞や自己評価ではなく、行動の水準で記述しようとするものである。",
        "Jackson ら（2010）は、誠実性に関連する日常の行動を収集し、それを測定する尺度を作成した。分析の結果、誠実性に関連する行動の下位構造は、既存の特性尺度に見られる構造とおおむね類似していた。この尺度は、日々の行動を記録する日誌法によっても検証されている。",
        "この研究が示すのは、誠実性が抽象的な自己像ではなく、持ち物を整理する、予定を記録する、約束の時刻を守る、課題を期限までに終えるといった、観察可能な行動の集まりとして捉えられるということである。本診断が具体的な場面での行動を問う形式をとっているのは、この考え方と対応する。",
        "ただし、行動の頻度は状況の影響を受ける。期限の厳しい環境にいる人は、特性にかかわらず計画的な行動を多く示す。行動を尋ねる形式の測定であっても、得点には、その人が置かれている環境の要求が含まれている。",
      ],
    },
    {
      heading: "4. 学業成績との関連",
      paragraphs: [
        "誠実性は、5因子の中で学業成績と最も一貫して関連する。Poropat（2009）は、5因子と学業成績の関係を扱ったメタ分析において、誠実性との相関を .22 と報告した。この関連は、知能とはおおむね独立であった。すなわち、誠実性は、知能では説明されない成績の個人差の一部を説明する。",
        "この数値は慎重に読む必要がある。相関 .22 は、成績の個人差のうち誠実性で説明される部分がおよそ5%であることを意味する。残りの大部分は、ほかの要因によって決まる。また、成績は、提出物や出席といった、誠実性に関連する行動そのものを評価に含むことが多い。誠実性と成績の関連の一部は、成績という指標の作られ方に由来する。",
      ],
    },
    {
      heading: "5. 職業上の成果との関連",
      paragraphs: [
        "職業上の成果については、Barrick & Mount（1991）のメタ分析が出発点となった。5因子のうち誠実性は、検討されたすべての職種と、すべての成果の指標に対して一貫した関連を示した。",
        "Wilmot & Ones（2019）は、その後の約100年分の研究を統合した。92のメタ分析、延べ110万人を超える参加者、175の変数を対象とした分析である。著者らは、誠実性を、職業上の成果に対して認知能力以外で最も強い関連を持つ構成概念であると結論した。同時に、この関連は職務の複雑さが高い場合には弱まることも報告されている。",
        "これらの知見の再現性も検討されている。Soto（2019）は、先行研究で報告された性格特性と人生上の結果との関連78件について、6,000人を超える標本で追試を行った。約87%が再現されたが、効果の大きさは、多くの場合もとの報告よりも小さかった。",
        "以上から言えるのは、誠実性と職業上の成果の関連は頑健であるが、大きくはないということである。この関連は、多数の人を集めたときに現れる傾向であり、ある個人が特定の職務で成果を上げるかどうかを予測するものではない。",
      ],
    },
    {
      heading: "6. 健康行動と寿命との関連",
      paragraphs: [
        "誠実性は、5因子の中で寿命との関連が最も一貫して報告されている因子である。Friedman ら（1993）は、1921年に開始された縦断研究の参加者1,178人のデータを用い、児童期に評定された誠実性が、中年期および高齢期までの生存を予測することを示した。",
        "この関連は、その後の研究で繰り返し確認されている。Kern & Friedman（2008）は20の独立した標本を統合し、誠実性と寿命の関連を r = .11 と推定した。Jokela ら（2013）は、7つのコホート、76,150人の個人データを統合した。誠実性が下位3分の1の者は、それ以外の者に比べて死亡のリスクが約1.4倍であった。5因子のうち、集団を超えて死亡リスクと一貫して関連したのは誠実性のみであった。",
        "関連が生じる経路としては、健康に関わる行動が検討されている。Bogg & Roberts（2004）は194の研究を統合し、誠実性に関連する特性が、喫煙や過度の飲酒といった健康上のリスクとなる行動と負の関連を、健康に資する行動と正の関連を示すことを明らかにした。ただし、Jokela ら（2013）において、誠実性と死亡リスクの関連は、健康行動、婚姻状況、学歴を統制した後にも残っていた。健康行動は経路の一部であるが、すべてではないと考えられる。",
        "これらの知見の読み方には、3つの注意が必要である。第1に、r = .11 は小さな関連である。誠実性の低い人の多くは長命であり、誠実性の高い人の多くがそうであるとは限らない。第2に、いずれも観察研究であり、誠実性を高めれば寿命が延びることを示したものではない。第3に、誠実性と健康の両方に影響する第3の要因が存在する可能性は排除されていない。",
      ],
    },
    {
      heading: "7. 自己統制およびグリットとの重なり",
      paragraphs: [
        "誠実性と内容の重なる概念は、複数の研究領域で別の名称のもとに研究されてきた。代表的なものが、自己統制とグリットである。",
        "Moffitt ら（2011）は、ニュージーランドの出生コホート約1,000人を出生から32歳まで追跡し、児童期の自己統制が、成人期の身体的健康、物質への依存、経済状態、犯罪歴を予測することを示した。この関連は、知能と出身家庭の社会階層を統制した後にも認められ、自己統制の水準に沿った勾配をなしていた。第2節で見たとおり、自己統制は誠実性の下位因子の1つとして位置づけられる。",
        "グリットは、Duckworth ら（2007）が、長期的な目標に対する粘り強さと情熱として定義した概念である。この概念は広く知られるようになったが、誠実性との区別については批判がある。Credé ら（2017）は、グリットに関する研究のメタ分析を行い、グリットが誠実性と非常に強く相関すること、成績や継続との関連は中程度にとどまること、2つの下位要素のうち努力の粘り強さのほうが関心の一貫性よりも成果と強く関連することを示した。",
        "同じ内容に異なる名称が与えられると、別々の発見が積み重なっているように見える。しかし、Credé らの結果は、グリットに関する知見の多くが、誠実性、とくに勤勉さの側面に関する知見として読み替えられることを示唆している。新しい名称の概念に接した場合は、それが既存の概念とどの程度異なるのかを確かめる必要がある。",
      ],
    },
    {
      heading: "8. 年齢による変化",
      paragraphs: [
        "誠実性の平均的な水準は、成人期を通じて上昇する。Roberts ら（2006）は縦断研究のメタ分析において、誠実性が成人期の前半を中心に上昇することを示した。協調性の上昇および神経症傾向の低下と合わせて、この変化は成熟の原則と呼ばれる。",
        "なぜ上昇するのかについては、2つの説明がある。1つは、遺伝的に規定された成熟とする説明である。もう1つは、就労、結婚、子育てといった成人としての役割を引き受けることが変化を促すとする、社会的投資理論である。",
        "Bleidorn ら（2013）は、62か国、884,328人の若年成人のデータを用いて両者を検討した。成人期の前半に誠実性が上昇する傾向は、文化を超えて認められた。同時に、成人としての役割を引き受ける時期が早い文化では、性格の成熟も早い時期に生じていた。後者の結果は、社会的投資理論と整合する。ただし、これは横断的なデータにもとづく文化間の比較であり、役割の引き受けが変化の原因であることを直接示したものではない。",
        "この知見は、誠実性の得点を読む際に考慮されるべきである。誠実性の得点が低いことは、固定された性質を示すとは限らない。若い回答者の場合、それは発達の途上の状態を反映している可能性がある。また、平均値の上昇は集団についての記述であり、すべての個人が同じ経過をたどるわけではない。",
      ],
    },
    {
      heading: "9. 高い誠実性をめぐる議論",
      paragraphs: [
        "誠実性は高いほど望ましいのか。この問いについて、研究の結果は一致していない。",
        "Carter ら（2016）は、912人を対象に、誠実性と心理的な安寧の関係を検討した。両者の関係は曲線的であり、強迫的な傾向と結びつきやすい下位特性において極端に高い得点を持つ者は、安寧が低かった。これに対して Nickel ら（2019）は、4つの標本を用いて、誠実性と健康、安寧、対人関係の満足、職務満足などの関係を検討したが、曲線的な関係を示す体系的な証拠は得られなかった。測定と得点化の方法を変えても、結果は同じであった。現時点では、極端に高い誠実性が一般に不利益をもたらすとは結論できない。",
        "状況によって誠実性の意味が変わることを示した研究もある。Boyce ら（2010）は、9,570人を4年間追跡し、失業後の生活満足度の低下を検討した。誠実性の高い者は、失業が長期に及んだ場合の生活満足度の低下が、誠実性の低い者よりも大きかった。目標の達成を重んじる傾向は、達成の手段が失われた状況では負担として働きうる。",
        "完全主義との関係も検討されている。Stricker ら（2019）は、72の標本、21,573人のデータを統合し、完全主義の2つの次元と5因子の関係を検討した。高い基準を追求する傾向は、5因子の中で誠実性と最も強く関連した（r = .37）。一方、失敗や他者からの評価を懸念する傾向は、5因子との関連のパターンがこれとは異なっていた。高い誠実性は高い基準の追求と重なるが、失敗への懸念と同じものではない。",
        "以上を総合すると、誠実性は多くの場面で望ましい結果と関連するが、その関連は状況に依存する。誠実性の低さもまた、単なる欠如ではない。予定の変更に柔軟に対応すること、その場の状況に即して動くことは、計画を重んじる傾向とは異なる形で機能する。",
      ],
    },
    {
      heading: "10. 文化と測定",
      paragraphs: [
        "誠実性は、自己評価による測定の限界が具体的に示された因子でもある。Heine ら（2008）は、国ごとの誠実性の平均値を検討した。自己評価および知人による評価から得られた国別の平均値は、誠実性を反映すると考えられる国別の客観的な指標と対応しなかった。",
        "著者らは、その理由として準拠集団効果を挙げている。Heine ら（2002）が指摘したとおり、人は自分の周囲の人々を基準として自己を評価する。勤勉であることが当然とされる環境にいる人は、同じ行動をとっていても、自分を相対的に低く評価する可能性がある。この解釈には異論もあり、国別の平均値の妥当性については議論が続いている。",
        "この問題は、文化間の比較に限られない。同じ文化の中でも、几帳面な人々に囲まれて生活している人は、自分の誠実性を低く見積もりうる。自己評価による得点は、絶対的な水準ではなく、回答者が想定した比較対象に対する相対的な位置を含んでいる。",
      ],
    },
    {
      heading: "11. 自己評価と他者評価",
      paragraphs: [
        "誠実性は、5因子の中で他者評価の有効性が最も明確に示されている因子の1つである。整理の程度、時間の守り方、課題への取り組み方は、行動として表に現れ、周囲の人が観察できるためである。",
        "Connelly & Ones（2010）は、263の独立した標本、4万人を超える対象者のデータを統合したメタ分析を行った。他者評価は行動を予測する力を持ち、学業成績や職務成績については、自己評価を上回る予測力を示した。これらは、第4節および第5節で見たとおり、誠実性が最も強く関連する結果である。",
        "Jackson ら（2015）は、1930年代に開始され、600人を約75年にわたって追跡した縦断研究のデータを用いた。20歳代の時点で友人から誠実性が高いと評定された男性は、その後の寿命が長かった。友人による評定は、本人の自己評価よりも寿命をよく予測した。著者らは、その理由の1つとして、複数の友人の評定を平均することで測定の信頼性が高まることを挙げている。なお、女性ではこれとは異なる特性が寿命と関連しており、著者らは研究が開始された時代の影響を指摘している。",
        "Vazire（2010）のモデルでは、評価的な意味合いの強い特性について、他者評価がより正確になりやすいとされる。誠実性は社会的に望ましいとされる特性であり、自己評価は、自分をよく見たいという動機と、前節で述べた比較対象の影響の両方を受ける。したがって、誠実性について自己評価と親しい他者の評価が食い違った場合、他者評価は、自己評価を補正する情報として読むことができる。ただし、他者が観察できるのは、その人と共にいる場面に限られる。職場での行動と家庭での行動が異なる場合、評価者によって評価が異なるのは当然である。",
      ],
    },
    {
      heading: "12. 本診断における測定",
      paragraphs: [
        "本診断は、誠実性を「達成欲求」と「秩序性」の2つの小項目によって測定している。各小項目は5問、計10問であり、回答は7段階である。一部の項目は、同意する傾向による偏りを抑えるため、逆方向に得点化している。項目は、抽象的な自己評価ではなく、具体的な場面での行動を問う形式をとっている。",
        "「達成欲求」の項目は、目標を持ち、それに向けて行動する程度を尋ねる。これは NEO-PI-R の達成追求に対応し、DeYoung ら（2007）の2つの側面では「勤勉さ」に属する。「秩序性」の項目は、持ち物の整理、予定の管理、事前の段取りを尋ねる。これは NEO-PI-R の秩序に対応し、2つの側面では「秩序性」に属する。すなわち本診断は、誠実性の2つの側面のそれぞれから、1つずつを取り出して測定している。",
        "一方、第2節で挙げた下位特性のうち、自己統制、責任感、慎重さは、独立した小項目としては測定していない。第6節で述べた健康行動との関連は、これらの下位特性に多くを負うとされる。したがって、健康や寿命に関する知見を、本診断の誠実性の得点にそのまま当てはめることはできない。",
        "友達診断は、同じ2つの小項目について、友達による評価を得るものである。第11節で述べたとおり、誠実性は他者評価が有効に機能しやすい特性である。とくに「秩序性」は行動として観察しやすい。「達成欲求」は内面の目標を含むため、友達の評価は、本人が目標に向けて行動している場面を見ている範囲に限られやすい。",
      ],
    },
    {
      heading: "13. 限界",
      paragraphs: [
        "本診断の結果を読む際には、以下の点に留意されたい。",
      ],
      list: [
        {
          term: "測定範囲",
          body: "2つの小項目は、誠実性の全体を網羅しない。自己統制、責任感、慎重さは、本診断の測定範囲に含まれない。正直さも測定していない。",
        },
        {
          term: "自己認識への依存",
          body: "得点は、回答時点における自己認識を反映する。行動そのものを観察して得たものではなく、回答者が想定した比較対象の影響を受ける。",
        },
        {
          term: "環境の要求",
          body: "計画的な行動の頻度は、学校や職場が求める水準によって変わる。得点には、特性だけでなく、現在の環境の影響が含まれる。",
        },
        {
          term: "年齢",
          body: "誠実性の平均的な水準は成人期を通じて上昇する。若い時期の得点は、その後も変化しうる。",
        },
        {
          term: "タイプの境界",
          body: "32のタイプは連続的な得点を尺度の中点で区切ったものである。境界付近では、回答のわずかな違いによって分類が変わりうる。",
        },
        {
          term: "集団の知見と個人",
          body: "本稿で引用した知見は、いずれも集団における平均的な傾向である。個人の成績、職業上の適性、健康、寿命を予測するものではない。",
        },
        {
          term: "優劣",
          body: "誠実性の高低に優劣はない。第9節で示したとおり、誠実性と望ましい結果との関連は状況に依存する。",
        },
      ],
    },
    {
      heading: "14. 結論",
      paragraphs: [
        "冒頭の3つの問いに答える。",
        "第1に、誠実性が測っているのは正直さではない。努力の持続に関わる部分と秩序に関わる部分を中心とし、自己統制や責任感を含む広い構成概念である。自己統制やグリットとして研究されてきた内容の多くは、この因子と重なる。",
        "第2に、誠実性は学業成績、職業上の成果、健康行動、寿命と一貫して関連する。ただし、関連はいずれも小さいか中程度であり、多数の人を集めたときに現れる傾向である。個人の成績や健康を予測するものではなく、誠実性を高めれば結果が変わることを示したものでもない。",
        "第3に、誠実性が高いほど望ましいとは言えない。極端に高い誠実性が不利益をもたらすかについて研究の結果は一致していないが、誠実性の意味が状況によって変わることは示されている。",
        "誠実性は、周囲から観察しやすく、かつ社会的に望ましいとされる特性である。このため、自己評価は比較対象と動機の影響を受けやすく、親しい他者の評価が有用な情報となる。誠実性の得点は、評価としてではなく、自分がどのような場面でどのように行動しているかの記述として読むのが適切である。",
      ],
    },
  ],
  references: [
    "Ashton, M. C., & Lee, K. (2007). Empirical, theoretical, and practical advantages of the HEXACO model of personality structure. Personality and Social Psychology Review, 11(2), 150–166.",
    "Barrick, M. R., & Mount, M. K. (1991). The Big Five personality dimensions and job performance: A meta-analysis. Personnel Psychology, 44(1), 1–26.",
    "Bleidorn, W., Klimstra, T. A., Denissen, J. J. A., Rentfrow, P. J., Potter, J., & Gosling, S. D. (2013). Personality maturation around the world: A cross-cultural examination of social-investment theory. Psychological Science, 24(12), 2530–2540.",
    "Bogg, T., & Roberts, B. W. (2004). Conscientiousness and health-related behaviors: A meta-analysis of the leading behavioral contributors to mortality. Psychological Bulletin, 130(6), 887–919.",
    "Boyce, C. J., Wood, A. M., & Brown, G. D. A. (2010). The dark side of conscientiousness: Conscientious people experience greater drops in life satisfaction following unemployment. Journal of Research in Personality, 44(4), 535–539.",
    "Carter, N. T., Guan, L., Maples, J. L., Williamson, R. L., & Miller, J. D. (2016). The downsides of extreme conscientiousness for psychological well-being: The role of obsessive compulsive tendencies. Journal of Personality, 84(4), 510–522.",
    "Connelly, B. S., & Ones, D. S. (2010). An other perspective on personality: Meta-analytic integration of observers' accuracy and predictive validity. Psychological Bulletin, 136(6), 1092–1122.",
    "Costa, P. T., & McCrae, R. R. (1992). Revised NEO Personality Inventory (NEO-PI-R) and NEO Five-Factor Inventory (NEO-FFI) professional manual. Psychological Assessment Resources.",
    "Credé, M., Tynan, M. C., & Harms, P. D. (2017). Much ado about grit: A meta-analytic synthesis of the grit literature. Journal of Personality and Social Psychology, 113(3), 492–511.",
    "DeYoung, C. G., Quilty, L. C., & Peterson, J. B. (2007). Between facets and domains: 10 aspects of the Big Five. Journal of Personality and Social Psychology, 93(5), 880–896.",
    "Duckworth, A. L., Peterson, C., Matthews, M. D., & Kelly, D. R. (2007). Grit: Perseverance and passion for long-term goals. Journal of Personality and Social Psychology, 92(6), 1087–1101.",
    "Friedman, H. S., Tucker, J. S., Tomlinson-Keasey, C., Schwartz, J. E., Wingard, D. L., & Criqui, M. H. (1993). Does childhood personality predict longevity? Journal of Personality and Social Psychology, 65(1), 176–185.",
    "Heine, S. J., Buchtel, E. E., & Norenzayan, A. (2008). What do cross-national comparisons of personality traits tell us? The case of conscientiousness. Psychological Science, 19(4), 309–313.",
    "Heine, S. J., Lehman, D. R., Peng, K., & Greenholtz, J. (2002). What's wrong with cross-cultural comparisons of subjective Likert scales?: The reference-group effect. Journal of Personality and Social Psychology, 82(6), 903–918.",
    "Jackson, J. J., Connolly, J. J., Garrison, S. M., Leveille, M. M., & Connolly, S. L. (2015). Your friends know how long you will live: A 75-year study of peer-rated personality traits. Psychological Science, 26(3), 335–340.",
    "Jackson, J. J., Wood, D., Bogg, T., Walton, K. E., Harms, P. D., & Roberts, B. W. (2010). What do conscientious people do? Development and validation of the Behavioral Indicators of Conscientiousness (BIC). Journal of Research in Personality, 44(4), 501–511.",
    "Jokela, M., Batty, G. D., Nyberg, S. T., Virtanen, M., Nabi, H., Singh-Manoux, A., & Kivimäki, M. (2013). Personality and all-cause mortality: Individual-participant meta-analysis of 3,947 deaths in 76,150 adults. American Journal of Epidemiology, 178(5), 667–675.",
    "Kern, M. L., & Friedman, H. S. (2008). Do conscientious individuals live longer? A quantitative review. Health Psychology, 27(5), 505–512.",
    "Moffitt, T. E., Arseneault, L., Belsky, D., Dickson, N., Hancox, R. J., Harrington, H., Houts, R., Poulton, R., Roberts, B. W., Ross, S., Sears, M. R., Thomson, W. M., & Caspi, A. (2011). A gradient of childhood self-control predicts health, wealth, and public safety. Proceedings of the National Academy of Sciences, 108(7), 2693–2698.",
    "Nickel, L. B., Roberts, B. W., & Chernyshenko, O. S. (2019). No evidence of a curvilinear relation between conscientiousness and relationship, work, and health outcomes. Journal of Personality and Social Psychology, 116(2), 296–312.",
    "Poropat, A. E. (2009). A meta-analysis of the five-factor model of personality and academic performance. Psychological Bulletin, 135(2), 322–338.",
    "Roberts, B. W., Chernyshenko, O. S., Stark, S., & Goldberg, L. R. (2005). The structure of conscientiousness: An empirical investigation based on seven major personality questionnaires. Personnel Psychology, 58(1), 103–139.",
    "Roberts, B. W., Lejuez, C., Krueger, R. F., Richards, J. M., & Hill, P. L. (2014). What is conscientiousness and how can it be assessed? Developmental Psychology, 50(5), 1315–1330.",
    "Roberts, B. W., Walton, K. E., & Viechtbauer, W. (2006). Patterns of mean-level change in personality traits across the life course: A meta-analysis of longitudinal studies. Psychological Bulletin, 132(1), 1–25.",
    "Soto, C. J. (2019). How replicable are links between personality traits and consequential life outcomes? The Life Outcomes of Personality Replication Project. Psychological Science, 30(5), 711–727.",
    "Soto, C. J., & John, O. P. (2017). The next Big Five Inventory (BFI-2): Developing and assessing a hierarchical model with 15 facets to enhance bandwidth, fidelity, and predictive power. Journal of Personality and Social Psychology, 113(1), 117–143.",
    "Stricker, J., Buecker, S., Schneider, M., & Preckel, F. (2019). Multidimensional perfectionism and the Big Five personality traits: A meta-analysis. European Journal of Personality, 33(2), 176–196.",
    "Vazire, S. (2010). Who knows what about a person? The self–other knowledge asymmetry (SOKA) model. Journal of Personality and Social Psychology, 98(2), 281–300.",
  ],
};
