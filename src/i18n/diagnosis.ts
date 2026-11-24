import type { QuestionSetId } from "@/lib/question-sets";
import type { AnswerValue, Question } from "@/lib/types";

export type DiagnosisLocale = "ja" | "ko" | "en" | "id";

export interface InAppBrowserCopy {
  title: string;
  description: string;
  copyButton: string;
  copiedButton: string;
  copyFallback: string;
  continueButton: string;
}

export interface DiagnosisCopy {
  heroTitle: string;
  heroSubtitle: string;
  heroImageAlt: string;
  nicknameLabel: string;
  // 最終カード (16P 風): ニックネーム説明 + 任意のジェンダー設問
  nicknameHelper: string;
  genderLabel: string;
  genderOptions: { value: "male" | "female" | "other"; label: string }[];
  nicknameEmptyError: string;
  nicknameTooLongError: (max: number) => string;
  nicknameRequired: string;
  nextButton: string;
  resultButton: string;
  submittingButton: string;
  submitError: string;
  previousPage: string;
  progressAriaLabel: (current: number, total: number) => string;
  questionAriaLabel: (number: number) => string;
  likertLeft: string;
  likertRight: string;
  likertOptions: Record<AnswerValue, string>;
  resume: {
    title: string;
    lead: string;
    unit: string;
    countSuffix: string;
    tail: string;
    continueButton: string;
    freshButton: string;
  };
  rediagnose: {
    title: string;
    lead: string;
    emphasis: string;
    emphasisSuffix: string;
    tail: string;
    confirmButton: string;
    cancelButton: string;
  };
  inAppBrowser: InAppBrowserCopy;
  analyzing: {
    messages: string[];
    steps: string[];
    // messages[i] の表示時間 (ms)。省略時や不足分は一律2000ms。
    // 最後のメッセージは画面遷移まで表示され続けるため対応する値は不要。
    messageDurationsMs?: number[];
    // 解析待ち画面の最低表示時間 (ms)。省略時は20秒。
    minLoadingMs?: number;
    // マスコットの代わりに流す機能紹介スライド。省略時はマスコットのみ。
    // 表示時間全体を枚数で等分して順に切り替え、最後の1枚で止まる。
    slides?: AnalyzingSlide[];
    // slides[i] の表示時間 (ms)。省略時や不足分は minLoadingMs を枚数で等分した長さ。
    // 合計が minLoadingMs と揃うように指定する (最後の1枚は遷移まで出続ける)。
    slideDurationsMs?: number[];
    // 各スライドのカード左上に出す見出し。全カード共通で、番号は付けない。
    slidesLabel?: string;
  };
}

type Voice = { face: string; color: string; text: string };

export interface AnalyzingSlide {
  // 絵は3種類。どれも表示された瞬間に要素が順にポンッと出る。
  //   voices: 左に「あなた」、右に友達3人の一言が1つずつ届く図。
  //   flip:   カードがめくれて、自己診断のあなたが友達診断のあなた (別のキャラ) に変わる図。
  //   send:   「リンク」が自分から友達へ届く図。
  //   chat:   トーク画面風。お願いとリンクを送ると、友達から返事が届く図。
  //   answer: 友達の30問バーが伸びて、完了スタンプが出る図。
  //   gap:    「自分 / 友達」のギャップ図。badge は最後に出るスタンプ。
  //   entry:  結果ページの下部ナビを模した図。「友達診断」タブを吹き出しで指す。
  //   welcome: (友達側) 最初のあいさつ。フェルトの絵と紙吹雪。
  //   questions: (友達側) 質問カード1枚の図。丸を選ぶと回答数が進み、完了スタンプが出る。
  //   deliver: (友達側) 回答用紙から紙ひこうきが飛んで、本人に届く図。
  //   results: (友達側) 本人が見られる結果のカードが3枚並ぶ図。
  // face はキャラクターの顔画像 (public/characters/face)。
  visual:
    | {
        kind: "voices";
        selfLabel: string;
        selfFace: string;
        voices: [Voice, Voice, Voice];
      }
    | {
        // 1枚のカードがめくれる図。表 = 自己診断のあなた、裏 = 友達診断のあなた (別のキャラ)。
        kind: "flip";
        // 表: 自己診断の見出しと、あなたのキャラ。
        selfTitle: string;
        selfFace: string;
        selfWord: string;
        // 裏: 友達診断の見出しと、友達から見たあなたのキャラ (輪の色つき)。
        friendTitle: string;
        perceivedFace: string;
        perceivedColor: string;
        perceivedWord: string;
      }
    | {
        kind: "send";
        selfLabel: string;
        selfFace: string;
        friendLabel: string;
        friendFace: string;
        linkLabel: string;
      }
    | {
        kind: "chat";
        // 自分が送るお願いの一言と、招待リンクのカード名。
        message: string;
        linkLabel: string;
        // 送ったカードの横に出る小さな表示 (既読)。
        readLabel: string;
        friendFace: string;
        // 友達からの返事。
        reply: string;
      }
    | {
        // 友達が質問に答えていく図。選択肢をタップ → 回答数が total まで進む → 完了スタンプ。
        kind: "quiz";
        friendLabel: string;
        friendFace: string;
        // 友達に出る質問の例。改行は "\n"。
        question: string;
        total: number;
        // 回答数の後ろに付ける単位 (例: 問)。
        unit: string;
        badge: string;
      }
    | { kind: "answer"; friendLabel: string; friendFace: string; countLabel: string; badge: string }
    | {
        // 友達側の「ようこそ」画面の1枚目。地色が白い絵を帯になじませて出し、紙吹雪を降らせる。
        kind: "welcome";
        image: string;
      }
    | {
        // 友達側の「ようこそ」画面用。質問カード1枚だけの図。丸の1つが選ばれ、
        // 回答数が total まで進んで完了スタンプが出る。
        kind: "questions";
        // 例として出す質問。改行は "\n"。
        question: string;
        total: number;
        // 回答数の後ろに付ける単位 (例: 問)。
        unit: string;
        badge: string;
      }
    | {
        // 友達側の「ようこそ」画面用。左の回答用紙から紙ひこうきが飛び、右の本人に届く図。
        kind: "deliver";
        // 回答用紙の見出し。
        sheetLabel: string;
        recipientName: string;
        recipientFace: string;
      }
    | {
        // 友達側の「ようこそ」画面用。本人が見られる結果のカードが3枚 (キャラ / 理解度 / ギャップ)
        // 順に出て、下に「ほかにもある」の札が出る図。
        kind: "results";
        // 3枚のカードの見出し (キャラ / 理解度 / ギャップ の順)。
        labels: [string, string, string];
        // 1枚目: 友達から見たキャラの顔と一言。
        face: string;
        faceColor: string;
        word: string;
        // 2枚目: 理解度の数字 (%)。
        score: number;
        // 下の札 (例: ほかの結果の名前)。
        more: string;
      }
    | {
        kind: "gap";
        badge: string;
        // 図の中のラベル。省略時は日本語 (自分 / 友達 / 外向性・協調性・開放性)。
        selfLabel?: string;
        friendLabel?: string;
        rowLabels?: [string, string, string];
      }
    | {
        // 完全版の購入後の準備画面用 (結果アップグレードの手順)。できあがる専用キャラと鑑定書が並ぶ図。
        kind: "upgradeResult";
        characterArt: string;
        characterLabel: string;
        bookArt: string;
        bookLabel: string;
      }
    | {
        // 完全版の購入後の準備画面用 (結果アップグレードの手順)。結果ページの一番下の金色のボタンを指す図。
        kind: "upgradeButton";
        selfFace: string;
        pageLabel: string;
        buttonLabel: string;
        // ボタンを指す吹き出し。
        bubble: string;
      }
    | {
        // 完全版の購入後の準備画面用 (結果アップグレードの手順)。Aliceの質問に答えるトークの図。
        kind: "aliceQa";
        aliceArt: string;
        // 質問の番号の札 (例: "質問 1 / 7")。
        counter: string;
        question: string;
        answer: string;
      }
    | {
        // 完全版の購入後の準備画面用。いつものキャラの顔が、あなた専用のキャラに変わる図。
        kind: "upgrade";
        // 左: いつものキャラの顔と札。
        beforeFace: string;
        beforeLabel: string;
        // 右: あなた専用のキャラの絵と札。
        afterArt: string;
        afterLabel: string;
      }
    | {
        kind: "entry";
        // 結果ページの見立て (顔 + 見出し)。
        selfFace: string;
        pageLabel: string;
        // 下部ナビ5タブの名前。実物 (src/i18n/ui/navigation) と同じ並びにする。2番目が友達診断。
        tabs: [string, string, string, string, string];
        // 「友達診断」タブを指す吹き出し。
        bubble: string;
      };
  // カードの見出しの前に出す札 (例: "STEP 1")。手順として見せたいスライドだけ指定する。
  step?: string;
  // 絵を載せる帯の色。
  tint: string;
  // スライドの文は1つだけ。改行は "\n"。highlight に一致する部分だけ色を変える。
  text: string;
  highlight?: string;
}

export interface DiagnosisLocaleSettings {
  locale: DiagnosisLocale;
  // 既定で出す質問セット。
  questions: Question[];
  // 質問セットを切り替えられる言語だけが持つ (日本語と韓国語)。
  //   id:   questions がどのセットか。回答と一緒に API と計測へ送る。
  //   sets: URL の ?qset=<id> で上書きできるセット。
  // 省略した言語では ?qset は無視され、セット id も送らない (API は従来セットで採点)。
  questionSet?: {
    id: QuestionSetId;
    sets: Record<QuestionSetId, Question[]>;
  };
  persistProgress: boolean;
  progressStorageKey: string;
  nicknameStorageKey: string;
  genderStorageKey: string;
  resultStorageKey: string;
  startedStorageKey: string;
  homePath: string;
  resultPath: string;
  copy: DiagnosisCopy;
}
