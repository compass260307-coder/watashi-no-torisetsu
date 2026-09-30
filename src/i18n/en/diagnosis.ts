import type { DiagnosisCopy, DiagnosisLocaleSettings } from "@/i18n/diagnosis";
import type { Question } from "@/lib/types";
const EN_QUESTIONS: Question[] = [
  {
    id: 1, text: "When opinions differ in a group, I clearly express what I think.", facetId: "E_assertiveness", dimension: "E", reversed: false
  },
  {
    id: 2, text: "When everyone asks where to go, I am usually the first to suggest a place.", facetId: "E_assertiveness", dimension: "E", reversed: false
  },
  {
    id: 3, text: "Even when I have something to say, I often hold back to keep the mood comfortable.", facetId: "E_assertiveness", dimension: "E", reversed: true
  },
  {
    id: 4, text: "If I disagree, I can say so no matter who I am talking to.", facetId: "E_assertiveness", dimension: "E", reversed: false
  },
  {
    id: 5, text: "I avoid speaking in front of a large audience whenever possible.", facetId: "E_assertiveness", dimension: "E", reversed: true
  },
  {
    id: 6, text: "I can become friendly with someone fairly quickly, even when we have just met.", facetId: "E_warmth", dimension: "E", reversed: false
  },
  {
    id: 7, text: "If a friend seems down, I am usually the one who reaches out first.", facetId: "E_warmth", dimension: "E", reversed: false
  },
  {
    id: 8, text: "I prefer to avoid talking with people I do not know.", facetId: "E_warmth", dimension: "E", reversed: true
  },
  {
    id: 9, text: "Talking with other people naturally puts a smile on my face.", facetId: "E_warmth", dimension: "E", reversed: false
  },
  {
    id: 10, text: "I rarely try to get deeply involved in other people's lives.", facetId: "E_warmth", dimension: "E", reversed: true
  },
  {
    id: 11, text: "In group work, I prioritize the overall flow over my own opinion.", facetId: "A_cooperation", dimension: "A", reversed: false
  },
  {
    id: 12, text: "When a friend and I disagree, I often end up going along with them.", facetId: "A_cooperation", dimension: "A", reversed: false
  },
  {
    id: 13, text: "I do not want to change my way of doing things just to fit in with others.", facetId: "A_cooperation", dimension: "A", reversed: true
  },
  {
    id: 14, text: "I do not mind giving a little if it means everyone can enjoy themselves.", facetId: "A_cooperation", dimension: "A", reversed: false
  },
  {
    id: 15, text: "I often want things to go my way.", facetId: "A_cooperation", dimension: "A", reversed: true
  },
  {
    id: 16, text: "When a friend cries, I feel like I might cry too.", facetId: "A_sympathy", dimension: "A", reversed: false
  },
  {
    id: 17, text: "I easily become absorbed in what characters feel in movies or comics.", facetId: "A_sympathy", dimension: "A", reversed: false
  },
  {
    id: 18, text: "I do not pay much attention to changes in other people's emotions.", facetId: "A_sympathy", dimension: "A", reversed: true
  },
  {
    id: 19, text: "Even a small change in a friend's expression makes me wonder what happened.", facetId: "A_sympathy", dimension: "A", reversed: false
  },
  {
    id: 20, text: "When someone says, 'I wish you understood how I feel,' I am not sure what they mean.", facetId: "A_sympathy", dimension: "A", reversed: true
  },
  {
    id: 21, text: "Hearing about a place I have never visited makes me want to go there.", facetId: "O_adventurousness", dimension: "O", reversed: false
  },
  {
    id: 22, text: "When traveling, I choose places known mostly to locals over famous attractions.", facetId: "O_adventurousness", dimension: "O", reversed: false
  },
  {
    id: 23, text: "Familiar places feel more comfortable to me than new ones.", facetId: "O_adventurousness", dimension: "O", reversed: true
  },
  {
    id: 24, text: "I am usually willing to try something I have never done before.", facetId: "O_adventurousness", dimension: "O", reversed: false
  },
  {
    id: 25, text: "I tend to be cautious when facing a new experience.", facetId: "O_adventurousness", dimension: "O", reversed: true
  },
  {
    id: 26, text: "Stories often appear in my mind when I am daydreaming.", facetId: "O_imagination", dimension: "O", reversed: false
  },
  {
    id: 27, text: "I seem to think of more possibilities than others when we look at the same scene.", facetId: "O_imagination", dimension: "O", reversed: false
  },
  {
    id: 28, text: "I almost never lose myself in fantasies or daydreams.", facetId: "O_imagination", dimension: "O", reversed: true
  },
  {
    id: 29, text: "I enjoy imagining 'what if' scenarios.", facetId: "O_imagination", dimension: "O", reversed: false
  },
  {
    id: 30, text: "I prefer to focus only on practical, realistic things.", facetId: "O_imagination", dimension: "O", reversed: true
  },
  {
    id: 31, text: "I almost always have a goal that I want to accomplish.", facetId: "C_achievement", dimension: "C", reversed: false
  },
  {
    id: 32, text: "On tests and assignments, I aim to do better than average.", facetId: "C_achievement", dimension: "C", reversed: false
  },
  {
    id: 33, text: "I think taking it easy is one of life's greatest pleasures.", facetId: "C_achievement", dimension: "C", reversed: true
  },
  {
    id: 34, text: "I set goals for myself and actively work toward them.", facetId: "C_achievement", dimension: "C", reversed: false
  },
  {
    id: 35, text: "I can enjoy each day even without a particular goal.", facetId: "C_achievement", dimension: "C", reversed: true
  },
  {
    id: 36, text: "My desk and bag are usually well organized.", facetId: "C_orderliness", dimension: "C", reversed: false
  },
  {
    id: 37, text: "I carefully manage my schedule with a planner or an app.", facetId: "C_orderliness", dimension: "C", reversed: false
  },
  {
    id: 38, text: "A messy room does not bother me very much.", facetId: "C_orderliness", dimension: "C", reversed: true
  },
  {
    id: 39, text: "Before starting something, I think through the steps and make a plan.", facetId: "C_orderliness", dimension: "C", reversed: false
  },
  {
    id: 40, text: "I often leave things out, thinking I can tidy them up later.", facetId: "C_orderliness", dimension: "C", reversed: true
  },
  {
    id: 41, text: "When I get irritated, it tends to show on my face or in my behavior.", facetId: "N_volatility", dimension: "N", reversed: false
  },
  {
    id: 42, text: "When something unpleasant happens, it takes me a while to feel better.", facetId: "N_volatility", dimension: "N", reversed: false
  },
  {
    id: 43, text: "Even when my emotions are unsettled, I tend not to show it.", facetId: "N_volatility", dimension: "N", reversed: true
  },
  {
    id: 44, text: "When I argue with a friend, I find it hard to contain my emotions.", facetId: "N_volatility", dimension: "N", reversed: false
  },
  {
    id: 45, text: "I can remain fairly calm in almost any situation.", facetId: "N_volatility", dimension: "N", reversed: true
  },
  {
    id: 46, text: "Before falling asleep, I often replay the day's events in my mind.", facetId: "N_anxiety", dimension: "N", reversed: false
  },
  {
    id: 47, text: "Before a test or presentation, I feel anxious unless I check everything several times.", facetId: "N_anxiety", dimension: "N", reversed: false
  },
  {
    id: 48, text: "I do not worry much about what might happen in the future.", facetId: "N_anxiety", dimension: "N", reversed: true
  },
  {
    id: 49, text: "I often look back and wonder whether I said something the wrong way.", facetId: "N_anxiety", dimension: "N", reversed: false
  },
  {
    id: 50, text: "I can trust myself to deal with a problem when it happens.", facetId: "N_anxiety", dimension: "N", reversed: true
  },
];
const EN_COPY: DiagnosisCopy = {
  heroTitle: "Free Big Five Personality Test",
  heroSubtitle: "Discover your type through the OCEAN (Big Five) model",
  heroImageAlt: "Characters from Alice Personalities",
  nicknameLabel: "Nickname",
  nicknameHelper: "This name will appear on your results page.",
  genderLabel: "Gender (optional)",
  genderOptions: [
    {
      value: "male", label: "Man"
    },
    {
      value: "female", label: "Woman"
    },
    {
      value: "other", label: "Other / prefer not to say"
    },
  ],
  nicknameEmptyError: "Please enter a nickname.",
  nicknameTooLongError: (max) => `Please use ${max} characters or fewer.`,
  nicknameRequired: "A nickname is required to view your result.",
  nextButton: "Next",
  resultButton: "See my result",
  submittingButton: "Analyzing...",
  submitError: "We couldn't save your answers. Please try again.",
  previousPage: "Previous page",
  progressAriaLabel: (current, total) => `Question ${current} of ${total}`,
  questionAriaLabel: (number) => `Question ${number}`,
  likertLeft: "Strongly agree",
  likertRight: "Strongly disagree",
  likertOptions: {
    7: "Strongly agree",
    6: "Agree",
    5: "Slightly agree",
    4: "Neither agree nor disagree",
    3: "Slightly disagree",
    2: "Disagree",
    1: "Strongly disagree",
  },
  resume: {
    title: "🔖 Continue where you left off?",
    lead: "You have saved answers",
    unit: "questions",
    countSuffix: ").",
    tail: "You can continue from your previous session.",
    continueButton: "Continue",
    freshButton: "Start over",
  },
  rediagnose: {
    title: "🔄 Take the test again",
    lead: "Your previous result and saved manual will ",
    emphasis: "remain available",
    emphasisSuffix: ".",
    tail: "Ready to discover something new about yourself? 🐧",
    confirmButton: "Start a new test",
    cancelButton: "Cancel and return home",
  },
  inAppBrowser: {
    title: "For the best experience, use Safari or Chrome",
    description: "In-app browsers in social apps may not save your result correctly.",
    copyButton: "Copy link",
    copiedButton: "Copied ✓",
    copyFallback: "If copying fails, press and hold the URL below:",
    continueButton: "Continue here",
  },
  analyzing: {
    messages: [
      "Reading your answers...",
      "Analyzing your Big Five traits...",
      "Looking at openness, conscientiousness, and extraversion...",
      "Exploring agreeableness and emotional sensitivity...",
      "Finding the type that fits you best...",
      "Narrowing down 32 personality types...",
      "Discovering your distinctive strengths...",
      "Preparing your Alice Personalities result...",
      "Adding the finishing touches...",
      "Your result is almost ready...",
    ],
    steps: ["Read answers", "Analyze traits", "Identify type", "Create your manual"],
  },
};
export const EN_DIAGNOSIS_SETTINGS: DiagnosisLocaleSettings = {
  locale: "en",
  questions: EN_QUESTIONS,
  persistProgress: false,
  progressStorageKey: "torisetsu_answers_v2_en",
  nicknameStorageKey: "torisetsu_nickname_v2_en",
  genderStorageKey: "torisetsu_gender_v1_en",
  resultStorageKey: "torisetsu_result_en",
  startedStorageKey: "torisetsu_diag_started_en",
  homePath: "/en",
  resultPath: "/en/result",
  copy: EN_COPY,
};
