export const EN_ARTICLE_CATEGORIES = [
  "Foundations",
  "Self-understanding",
  "Friends & relationships",
] as const;

export type EnArticleCategory = (typeof EN_ARTICLE_CATEGORIES)[number];

export type EnArticleSection = {
  heading: string;
  paragraphs: string[];
  list?: { term: string; body: string }[];
};

export type EnArticle = {
  slug: string;
  title: string;
  listTitle: string;
  description: string;
  category: EnArticleCategory;
  published: string;
  updated?: string;
  image: string;
  imageAlt: string;
  lead: string[];
  sections: EnArticleSection[];
};

type FactorArticleInput = {
  slug: string;
  letter: string;
  factor: string;
  question: string;
  description: string;
  image: string;
  imageAlt: string;
  highIntro: string;
  high: { term: string; body: string }[];
  lowIntro: string;
  low: { term: string; body: string }[];
  misconception: [string, string];
  practice: string;
};

function factorArticle(input: FactorArticleInput): EnArticle {
  return {
    slug: input.slug,
    title: `What is ${input.factor} (${input.letter}) in the Big Five? ${input.question}`,
    listTitle: `${input.factor} (${input.letter}): ${input.question}`,
    description: input.description,
    category: "Self-understanding",
    published: "2026-07-21",
    image: input.image,
    imageAlt: input.imageAlt,
    lead: [
      `${input.factor} is one of the five dimensions in the Big Five, or OCEAN, model. It describes a tendency, not a fixed identity or a measure of personal worth.`,
      `A higher or lower score can each be useful in different settings. Understanding the trade-offs makes the score practical rather than judgmental.`,
    ],
    sections: [
      {
        heading: `Common traits of people higher in ${input.factor.toLowerCase()}`,
        paragraphs: [input.highIntro],
        list: input.high,
      },
      {
        heading: `Common traits of people lower in ${input.factor.toLowerCase()}`,
        paragraphs: [input.lowIntro],
        list: input.low,
      },
      {
        heading: "A common misunderstanding",
        paragraphs: input.misconception,
      },
      {
        heading: `Measure your ${input.factor.toLowerCase()}`,
        paragraphs: [input.practice],
      },
    ],
  };
}

export const EN_ARTICLES: EnArticle[] = [
  {
    slug: "ocean-shindan",
    title: "What is the OCEAN personality test? A clear guide to the five Big Five traits",
    listTitle: "What is the OCEAN personality test?",
    description: "Learn how the OCEAN, or Big Five, model describes personality through Openness, Conscientiousness, Extraversion, Agreeableness, and Neuroticism—and how it differs from type-based tests.",
    category: "Foundations",
    published: "2026-07-21",
    image: "/mascot/diagnosis-hero.png",
    imageAlt: "Alice Diagnosis characters taking a personality test",
    lead: [
      "The OCEAN personality test is based on the Big Five, one of the most widely researched frameworks in personality psychology. It describes personality as a pattern across five continuous dimensions.",
      "This guide explains the five traits, the difference between dimensions and personality types, and why feedback from other people can add something a self-report cannot show on its own.",
    ],
    sections: [
      {
        heading: "What does OCEAN mean?",
        paragraphs: [
          "OCEAN is formed from the initials of Openness, Conscientiousness, Extraversion, Agreeableness, and Neuroticism. Together, these dimensions provide a shared vocabulary for describing broad patterns in how people think, act, relate, and respond to stress.",
          "The model does not place everyone into a single box. Each trait is measured along a continuum, so a person can be highly conscientious, moderately extraverted, and close to the middle on openness at the same time.",
        ],
      },
      {
        heading: "The five personality dimensions",
        paragraphs: ["No end of a dimension is automatically better. Each tendency brings strengths and trade-offs that depend on the situation."],
        list: [
          { term: "Openness (O)", body: "Curiosity toward ideas, experiences, imagination, and change. Lower scores often favor practicality, familiarity, and proven methods." },
          { term: "Conscientiousness (C)", body: "Preference for planning, structure, follow-through, and standards. Lower scores can support flexibility and quick adaptation." },
          { term: "Extraversion (E)", body: "Tendency to gain energy from stimulation and social engagement. Lower scores often recharge through solitude or smaller groups." },
          { term: "Agreeableness (A)", body: "Attention to cooperation, trust, and other people’s needs. Lower scores can make direct debate and hard negotiation easier." },
          { term: "Neuroticism (N)", body: "Sensitivity to emotion, threat, and uncertainty. Lower scores tend to remain steadier under pressure, while higher scores may detect risk sooner." },
        ],
      },
      {
        heading: "How it differs from a 16-type personality test",
        paragraphs: [
          "A 16-type test combines several either-or preferences into a memorable category. That makes results easy to discuss and share with friends.",
          "OCEAN keeps the underlying scores continuous. Someone near the center of a dimension can be described as such instead of being pushed to one side of a boundary.",
          "Alice Diagnosis measures the five OCEAN dimensions, then turns the pattern into one of 32 characters. The scores preserve nuance while the character makes the result easier to remember and use.",
        ],
      },
      {
        heading: "How reliable is an OCEAN result?",
        paragraphs: [
          "The five-factor structure has been studied for decades and observed across many languages and cultures. It remains one of the best-supported general models for describing personality traits.",
          "A self-report still reflects the self you can currently see. Mood, context, and the way you interpret a question can affect an answer, so a result is best treated as a useful snapshot rather than a permanent verdict.",
        ],
      },
      {
        heading: "Friends can reveal the part you cannot see alone",
        paragraphs: [
          "Other people observe your behavior from a different angle. A habit that feels ordinary to you may be the exact quality they rely on most.",
          "Differences between self-ratings and friend ratings are not necessarily errors. They can show how intention, behavior, and impact diverge across situations.",
          "That is why Alice Diagnosis combines your own answers with optional friend feedback: not to decide who is right, but to make the picture wider.",
        ],
      },
    ],
  },
  {
    slug: "sixteen-types-vs-ocean",
    title: "OCEAN vs. 16-type personality tests: what is the difference, and which is more accurate?",
    listTitle: "OCEAN vs. 16-type personality tests",
    description: "Compare type-based personality tests with the continuous Big Five model, including the strengths, limits, and best use of each approach.",
    category: "Foundations",
    published: "2026-07-21",
    image: "/characters/v3/hawk_R.webp",
    imageAlt: "A thoughtful hawk character comparing personality frameworks",
    lead: [
      "Type-based tests and the OCEAN model can both help people talk about personality, but they answer the question in different ways.",
      "The important distinction is not that one is fun and the other is serious. It is whether a result uses categories or continuous dimensions, and what you want to do with it afterward.",
    ],
    sections: [
      { heading: "The biggest difference: boxes or gradients", paragraphs: ["A type system draws boundaries and gives the resulting combination a name. It creates a clear identity that is easy to recognize.", "OCEAN measures five separate gradients. It can show that two people with the same broad pattern still differ meaningfully in degree."] },
      { heading: "The strengths and limits of 16 types", paragraphs: ["A type is memorable, social, and easy to turn into a shared language. It can prompt useful reflection quickly.", "Its boundary can also exaggerate small score differences. People close to the middle may receive different labels even when their answers are very similar."] },
      { heading: "The strengths and limits of OCEAN", paragraphs: ["Continuous scores preserve nuance and are well suited to research, comparison, and tracking gradual differences.", "Numbers alone can feel abstract. A technically precise graph may be harder to remember or discuss than a well-designed character or story."] },
      { heading: "You can combine accuracy with enjoyment", paragraphs: ["Alice Diagnosis begins with OCEAN scores and uses a 32-character system to make the pattern approachable. The character summarizes the result; it does not replace the five scores beneath it.", "Use the character to start a conversation, then return to the dimensions when you want a more precise explanation of a strength, tension, or relationship."] },
    ],
  },
  factorArticle({
    slug: "kaihousei", letter: "O", factor: "Openness", question: "high and low scores explained",
    description: "Understand high and low Openness scores, from imagination and novelty to practicality and trusted routines.",
    image: "/characters/v3/unicorn_N.webp", imageAlt: "A unicorn character representing openness and imagination",
    highIntro: "Higher openness often appears as curiosity, imagination, and an appetite for unfamiliar perspectives.",
    high: [
      { term: "Curiosity", body: "You enjoy exploring ideas before knowing whether they will be useful." },
      { term: "Imagination", body: "Metaphor, possibility, and alternative futures come naturally." },
      { term: "Comfort with change", body: "Variety can feel energizing rather than disruptive." },
    ],
    lowIntro: "Lower openness often appears as realism, continuity, and respect for methods that have already proved their value.",
    low: [
      { term: "Practical judgment", body: "You prefer ideas that can survive contact with everyday life." },
      { term: "Consistency", body: "Familiar routines free attention for careful execution." },
      { term: "Depth through repetition", body: "You can refine a reliable craft instead of constantly chasing novelty." },
    ],
    misconception: ["Lower openness does not mean a lack of intelligence or creativity. Creativity can be practical, technical, or expressed through refinement.", "Higher openness is not automatically better either; too much novelty can make commitment and completion harder."],
    practice: "Notice whether you feel most alive while discovering a new possibility or improving something established. Your score helps name that preference without limiting what you can learn.",
  }),
  factorArticle({
    slug: "seijitsusei", letter: "C", factor: "Conscientiousness", question: "high and low scores explained",
    description: "Learn how Conscientiousness relates to planning, follow-through, flexibility, and the way you manage goals.",
    image: "/characters/v3/bear_R.webp", imageAlt: "A dependable bear character representing conscientiousness",
    highIntro: "Higher conscientiousness favors structure, preparation, and finishing what has been promised.",
    high: [
      { term: "Planning", body: "You reduce uncertainty by deciding the sequence before you begin." },
      { term: "Follow-through", body: "Commitments remain visible even after the initial excitement fades." },
      { term: "Standards", body: "Accuracy and completeness are part of how you build trust." },
    ],
    lowIntro: "Lower conscientiousness often favors spontaneity, responsiveness, and changing course when circumstances change.",
    low: [
      { term: "Flexibility", body: "You can adapt without feeling bound to the original plan." },
      { term: "Fast starts", body: "You may act while others are still organizing." },
      { term: "Improvisation", body: "Unexpected constraints can bring out resourceful solutions." },
    ],
    misconception: ["Lower conscientiousness does not simply mean lazy, and higher conscientiousness does not guarantee effectiveness.", "Structure helps when it serves the goal; it becomes costly when perfection or rigid planning consumes the time needed to act."],
    practice: "Look at how you handle an ordinary deadline. Do you gain energy from a plan or from room to improvise? The answer reveals the conditions in which your effort is easiest to sustain.",
  }),
  factorArticle({
    slug: "gaikousei", letter: "E", factor: "Extraversion", question: "is being introverted a bad thing?",
    description: "Explore Extraversion as a difference in energy and stimulation—not a judgment about confidence or social skill.",
    image: "/characters/v3/dolphin_R.webp", imageAlt: "A lively dolphin character representing extraversion",
    highIntro: "Higher extraversion often brings visible energy, quick engagement, and comfort with stimulation.",
    high: [
      { term: "Social energy", body: "Conversation and shared activity can recharge you." },
      { term: "Initiative", body: "You may think by speaking and enter a situation quickly." },
      { term: "Expressiveness", body: "Other people can usually tell when you are enthusiastic." },
    ],
    lowIntro: "Lower extraversion, often called introversion, favors lower stimulation and more time to process internally.",
    low: [
      { term: "Deep focus", body: "Solitude can support sustained attention and original thought." },
      { term: "Selective connection", body: "A few substantial relationships may feel richer than a wide network." },
      { term: "Observation", body: "You often understand the room before deciding how to enter it." },
    ],
    misconception: ["Introversion is not the same as shyness or poor communication. A reserved person may be confident and socially skilled while still needing quiet recovery time.", "Extraversion is not the same as superficiality. Visible enthusiasm can help groups coordinate, connect, and move."],
    practice: "Pay attention to what restores you after a demanding week: more people and activity, or fewer inputs and deeper rest. That pattern is often more informative than how talkative you appear.",
  }),
  factorArticle({
    slug: "kyouchousei", letter: "A", factor: "Agreeableness", question: "high and low scores explained",
    description: "Understand Agreeableness through cooperation, empathy, candor, boundaries, and negotiation.",
    image: "/characters/v3/angel_N.webp", imageAlt: "A gentle angel character representing agreeableness",
    highIntro: "Higher agreeableness often prioritizes trust, harmony, and the emotional effect of a decision.",
    high: [
      { term: "Empathy", body: "You notice how an outcome will feel to the people involved." },
      { term: "Cooperation", body: "You naturally search for a solution that preserves the relationship." },
      { term: "Trust", body: "You are willing to begin from goodwill rather than suspicion." },
    ],
    lowIntro: "Lower agreeableness often supports candor, skepticism, and a willingness to hold a difficult line.",
    low: [
      { term: "Directness", body: "You can name the problem without wrapping it in excessive reassurance." },
      { term: "Negotiation", body: "Competing interests do not automatically make you uncomfortable." },
      { term: "Independent judgment", body: "You can disagree with the group and continue thinking clearly." },
    ],
    misconception: ["A lower score does not make someone unkind, just as a higher score does not make every decision fair.", "Cooperation needs boundaries, while candor needs care. The useful question is whether your default matches what the moment requires."],
    practice: "Think about your last disagreement. Did you protect harmony first or clarity first? Your score can help you practice the less automatic side without abandoning your strengths.",
  }),
  factorArticle({
    slug: "shinkeisho-keiko", letter: "N", factor: "Neuroticism", question: "how sensitivity can become a strength",
    description: "Learn how emotional sensitivity and steadiness each work, and how to use sensitivity without becoming overwhelmed.",
    image: "/characters/v3/rabbit_N.webp", imageAlt: "A sensitive rabbit character representing emotional awareness",
    highIntro: "Higher neuroticism means the emotional and threat-detection systems respond readily to uncertainty, pressure, and change.",
    high: [
      { term: "Early warning", body: "You may notice risk before other people take it seriously." },
      { term: "Emotional nuance", body: "Small changes in tone or atmosphere carry useful information." },
      { term: "Preparation", body: "Anticipating difficulty can motivate careful contingency planning." },
    ],
    lowIntro: "Lower neuroticism often brings emotional steadiness, quick recovery, and calm under pressure.",
    low: [
      { term: "Composure", body: "Stress is less likely to take over the whole field of attention." },
      { term: "Recovery", body: "A setback may leave less emotional residue." },
      { term: "Tolerance for uncertainty", body: "You can continue acting without resolving every possible risk." },
    ],
    misconception: ["A higher score is not weakness. Sensitivity can support empathy, foresight, artistry, and precise care.", "A lower score is not indifference. Calm people can care deeply while experiencing less internal alarm."],
    practice: "Treat sensitivity as a signal rather than a command. Naming the feeling, checking the evidence, and choosing one next action can turn early warning into useful preparation.",
  }),
  {
    slug: "torisetsu-tsukurikata",
    title: "How to create your own user manual: a practical path to self-understanding",
    listTitle: "How to create your own user manual",
    description: "Create a personal user manual that explains your strengths, stress signals, communication needs, and best ways to recover.",
    category: "Self-understanding", published: "2026-07-21", image: "/mascot/friend-hero.png",
    imageAlt: "Friends creating a personal user manual together",
    lead: ["Self-analysis can feel like trying to describe water while swimming in it. A personal user manual makes the task concrete: what helps you work, connect, recover, and make decisions?", "The goal is not to define yourself forever. It is to give yourself and trusted people a usable guide for the person you are now."],
    sections: [
      { heading: "What belongs in a personal user manual", paragraphs: ["Start with situations and observable patterns rather than abstract labels."], list: [
        { term: "Conditions where you do your best", body: "The pace, structure, people, and environment that help your strengths appear." },
        { term: "Communication preferences", body: "How you like to receive context, feedback, decisions, and emotional support." },
        { term: "Early stress signals", body: "The small behavioral or physical changes that appear before overload." },
        { term: "Ways to reset", body: "Specific actions that reliably help you recover attention and perspective." },
      ] },
      { heading: "Step 1: begin with patterns, not ideals", paragraphs: ["Review recent moments that felt easy, difficult, energizing, or draining. Write what actually happened instead of what you think should have happened.", "Look for repetition. One unusual day says little; the same reaction across work, friendship, and home is more likely to be part of your pattern."] },
      { heading: "Step 2: add another person’s perspective", paragraphs: ["Ask someone you trust what they rely on you for and what becomes hard to read about you under stress.", "Treat a difference as information rather than a verdict. Your intention and another person’s experience can both be true." ] },
      { heading: "Keep the manual editable", paragraphs: ["Add dates and examples, then revisit the manual after a change in role, relationship, or environment.", "A useful manual gives you more choices. If a sentence makes you feel trapped, rewrite it as a tendency, condition, or current hypothesis." ] },
    ],
  },
  {
    slug: "johari-no-mado", title: "The Johari Window: a framework for discovering the self you cannot see alone", listTitle: "What is the Johari Window?",
    description: "Use the Johari Window to understand what is known or hidden to yourself and others, and why thoughtful feedback expands self-awareness.",
    category: "Self-understanding", published: "2026-07-21", image: "/characters/v3/fox_N.webp", imageAlt: "A fox character looking through a window of self-awareness",
    lead: ["The Johari Window is a simple framework for comparing what you know about yourself with what other people can see.", "It divides information into four areas and shows why self-disclosure and feedback are both needed for deeper self-understanding."],
    sections: [
      { heading: "The four areas of the Johari Window", paragraphs: ["The open area is known to you and others; the hidden area is known to you but not others; the blind area is visible to others but not you; and the unknown area has not yet become clear to anyone."], list: [
        { term: "Open area", body: "Qualities and experiences that both you and other people recognize." },
        { term: "Hidden area", body: "Feelings, needs, and history you have not shared." },
        { term: "Blind area", body: "Your impact, habits, or strengths that others notice before you do." },
        { term: "Unknown area", body: "Potential and reactions that may emerge in a new situation." },
      ] },
      { heading: "Why the blind area matters", paragraphs: ["People become accustomed to their own strengths and often stop noticing them. The same is true of habits that unintentionally confuse or pressure others.", "Specific feedback turns that invisible impact into something you can understand and choose how to use." ] },
      { heading: "How to ask for feedback safely", paragraphs: ["Ask a narrow question about a real context, such as how you respond during disagreement or what people value when working with you.", "Invite examples and avoid arguing with the first answer. You can decide what fits after you have listened." ] },
      { heading: "Feedback is a window, not a final judgment", paragraphs: ["One person sees you from one position. Combine several perspectives with your own experience before drawing a conclusion.", "The purpose is not to surrender your identity to other people, but to understand the effect you already have." ] },
    ],
  },
  {
    slug: "seikaku-aisho", title: "Can personality types predict compatibility? A better way to explore love and friendship", listTitle: "Can personality types predict compatibility?",
    description: "Learn what personality compatibility can and cannot tell you about love, friendship, work, conflict, and communication.",
    category: "Friends & relationships", published: "2026-07-21", image: "/characters/v3/penguin_N.webp", imageAlt: "Two characters exploring personality compatibility",
    lead: ["Compatibility is not a score for whether two people should stay together. It is a map of where interaction may feel natural and where translation may be needed.", "Personality can clarify differences in pace, stimulation, planning, trust, and emotional sensitivity, but it cannot replace respect, safety, or shared effort."],
    sections: [
      { heading: "Similarity can make daily life easier", paragraphs: ["Similar tendencies create shared assumptions. Two planners may agree on preparation, while two introverts may protect quiet time without needing to explain it.", "Similarity can also reinforce the same blind spot. A pair who both avoids conflict may preserve calm while leaving an important issue untouched." ] },
      { heading: "Difference can create balance—or friction", paragraphs: ["Different traits can complement each other: one person introduces novelty while the other protects continuity.", "The same difference becomes friction when each person treats their own preference as the only reasonable one. Naming the trait turns blame into a negotiable need." ] },
      { heading: "Use compatibility as a conversation starter", paragraphs: ["Compare a specific dimension and ask how it appears in ordinary life. Discuss plans, social energy, directness, and recovery before discussing labels.", "A useful compatibility reading gives both people practical choices. It should never excuse disrespect or claim that conflict is inevitable." ] },
      { heading: "What matters beyond personality", paragraphs: ["Values, circumstances, communication skills, power, timing, and willingness to repair all shape a relationship.", "Personality explains recurring tendencies. The quality of the relationship depends on what both people do with that knowledge." ] },
    ],
  },
  {
    slug: "tako-bunseki", title: "How to ask for personality feedback and discover the self you cannot see alone", listTitle: "How to ask friends for personality feedback",
    description: "A practical guide to gathering outside perspectives without awkwardness, comparing them with self-ratings, and using differences constructively.",
    category: "Friends & relationships", published: "2026-08-07", image: "/characters/v3/octopus_N.webp", imageAlt: "An octopus character gathering thoughtful feedback from friends",
    lead: ["Self-reflection shows intention and inner experience. Feedback shows what other people can observe and what your behavior creates around them.", "Using both perspectives helps uncover strengths you take for granted and gaps between what you mean and what others receive."],
    sections: [
      { heading: "Why self-analysis alone has limits", paragraphs: ["Familiar habits become invisible. You may overlook a dependable strength because it feels ordinary, or miss a confusing pattern because you know the intention behind it.", "Other people cannot see your whole inner life, but they can report the effect you have in moments you may not remember clearly."], list: [
        { term: "Self-analysis", body: "Shows your intentions, private experience, values, and the reasons behind your choices." },
        { term: "Outside perspective", body: "Shows observable behavior, impact, and patterns that have become too familiar for you to notice." },
      ] },
      { heading: "What outside perspectives can reveal", paragraphs: ["Feedback is especially useful for observable patterns: how you enter a group, react under pressure, communicate disagreement, or support someone who is struggling.", "The gap between self and others is often the most valuable part. It creates a question worth exploring rather than a winner and a loser." ] },
      { heading: "A simple three-step method", paragraphs: ["Keep the request focused and easy to answer."], list: [
        { term: "1. Choose several viewpoints", body: "Ask people who know you in different settings rather than relying on one relationship." },
        { term: "2. Use consistent questions", body: "The same prompts make similarities and differences easier to compare." },
        { term: "3. Look for patterns", body: "Prioritize repeated observations and concrete examples over one surprising comment." },
      ] },
      { heading: "Anonymous and choice-based questions reduce awkwardness", paragraphs: ["People answer more honestly when they are not forced to compose a criticism or attach their name to every observation.", "Choice-based questions create a shared structure, while an optional message leaves room for nuance and kindness." ] },
      { heading: "Try friend feedback in Alice Diagnosis", paragraphs: ["Complete your own OCEAN test, share your invitation link, and compare your self-view with the patterns in your friends’ answers.", "Use the result as the beginning of a conversation. A good insight should make understanding easier, not make anyone feel reduced to a label." ] },
    ],
  },
];

export function getEnArticle(slug: string): EnArticle | undefined {
  return EN_ARTICLES.find((article) => article.slug === slug);
}

const RELATED: Record<string, string[]> = {
  "ocean-shindan": ["sixteen-types-vs-ocean", "kaihousei", "tako-bunseki"],
  "sixteen-types-vs-ocean": ["ocean-shindan", "torisetsu-tsukurikata", "johari-no-mado"],
  kaihousei: ["ocean-shindan", "seijitsusei", "gaikousei"],
  seijitsusei: ["ocean-shindan", "kaihousei", "kyouchousei"],
  gaikousei: ["ocean-shindan", "kyouchousei", "seikaku-aisho"],
  kyouchousei: ["ocean-shindan", "gaikousei", "seikaku-aisho"],
  "shinkeisho-keiko": ["ocean-shindan", "johari-no-mado", "torisetsu-tsukurikata"],
  "torisetsu-tsukurikata": ["johari-no-mado", "tako-bunseki", "ocean-shindan"],
  "johari-no-mado": ["tako-bunseki", "torisetsu-tsukurikata", "ocean-shindan"],
  "seikaku-aisho": ["kyouchousei", "gaikousei", "tako-bunseki"],
  "tako-bunseki": ["johari-no-mado", "torisetsu-tsukurikata", "seikaku-aisho"],
};

export function getEnRelatedArticles(slug: string): EnArticle[] {
  return (RELATED[slug] ?? [])
    .map((relatedSlug) => getEnArticle(relatedSlug))
    .filter((article): article is EnArticle => Boolean(article));
}
