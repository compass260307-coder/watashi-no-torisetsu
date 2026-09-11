import type { SixteenTypeId } from "@/lib/sixteen-types";
import { baseIdOf, nAxisOf, type ThirtyTwoTypeId } from "@/lib/thirty-two-types";
import type { BigFiveDimension } from "@/lib/types";
import type { SelfSection } from "@/lib/self-result-content";
import type { ResolvedDeepDiveSection } from "@/lib/deep-dive-resolve";
import type { ResolvedPartTwo } from "@/lib/part-two-resolve";
import type { MoshimoScene } from "@/lib/moshimo-resolve";

type BaseProfile = {
  core: string;
  strength: string;
  love: string;
  career: string;
  growth: string;
  caution: string;
  connection: string;
};

const BASE_PROFILES: Record<SixteenTypeId, BaseProfile> = {
  "sparkle-dolphin": {
    core: "You naturally connect possibility with people. You can imagine a better direction, explain it with energy, and make others feel included in the journey. Your optimism is most convincing when it is backed by the preparation and follow-through you already value.",
    strength: "Your signature strength is generous leadership. You notice what each person can contribute, keep the larger purpose visible, and create enough momentum for a group to move together.",
    love: "In love, you are expressive, attentive, and serious about building something meaningful. You thrive with a partner who enjoys your enthusiasm but can also share the emotional and practical work of the relationship.",
    career: "You do well where vision, coordination, and communication meet: leading a project, developing people, building a community, or turning a promising idea into a plan others can trust.",
    growth: "Leave a little room for other people to shape the destination. Asking before helping and listening before rallying the group makes your leadership feel even more empowering.",
    caution: "Because you can see both the opportunity and the people who need support, you may volunteer for too much. A full calendar is not always proof that you are using your gifts well.",
    connection: "You connect best with people who are warm but self-directed—people who appreciate your encouragement, tell you the truth, and take responsibility for their own part.",
  },
  "ambition-lion": {
    core: "You are motivated by progress with a purpose. Once a goal feels worthwhile, you organize your effort around it and speak with a clarity that can pull others forward. You prefer honest movement to comfortable stagnation.",
    strength: "Your signature strength is decisive vision. You can separate the central issue from the surrounding noise, choose a direction, and maintain standards when the work becomes demanding.",
    love: "In love, you respect confidence, candor, and shared ambition. You show care by protecting the future of the relationship, although your partner may sometimes need warmth before solutions.",
    career: "You flourish in roles with ownership and visible outcomes: strategy, entrepreneurship, product leadership, negotiation, or any setting where difficult choices must become coordinated action.",
    growth: "Treat emotional information as data rather than delay. Slowing down long enough to understand resistance often gives you a stronger plan and more durable commitment.",
    caution: "Your speed and certainty can make a discussion feel decided before others have entered it. When pressure rises, your efficiency may be heard as dismissal.",
    connection: "You connect best with people who have a sturdy sense of self, communicate directly, and can challenge your thinking without turning every disagreement into a contest.",
  },
  "quiet-owl": {
    core: "You build thoughtful structures around humane ideals. You may not seek the center of attention, yet you observe carefully, prepare thoroughly, and often understand what a person or system needs before it is said aloud.",
    strength: "Your signature strength is quiet stewardship. You combine imagination with reliability, turning subtle insight into plans, words, or systems that make life gentler and clearer.",
    love: "In love, you open gradually and care deeply. Consistency, emotional safety, and conversations with real substance matter more to you than constant excitement or public displays.",
    career: "You thrive in focused work that improves something meaningful: research, writing, design, counseling, planning, education, or careful behind-the-scenes leadership.",
    growth: "Let people see your thinking before it is perfectly formed. Sharing an early draft of an idea gives others a chance to support you instead of discovering your effort only at the end.",
    caution: "You can quietly absorb responsibility and disappointment until both become heavy. Because you appear composed, others may not realize that you need reassurance or help.",
    connection: "You connect best with patient, sincere people who respect solitude, keep their word, and invite your inner world out without trying to force it open.",
  },
  "seeker-wolf": {
    core: "You are an independent investigator with a strong internal standard. You would rather understand something properly than repeat a convenient answer, and you are willing to work alone until the pattern makes sense.",
    strength: "Your signature strength is disciplined depth. You notice contradictions, protect quality, and keep examining a problem after other people have accepted the first plausible explanation.",
    love: "In love, you value trust, intellectual respect, and plenty of breathing room. You tend to show devotion through loyalty and practical attention rather than frequent declarations.",
    career: "You excel where expertise and autonomy matter: analysis, engineering, research, craft, systems design, investigation, or specialist work with a demanding quality bar.",
    growth: "Explain the reason behind your standards. What feels self-evident to you may be invisible to others, and a brief explanation can turn perceived stubbornness into useful precision.",
    caution: "When the environment feels careless or intrusive, you may withdraw and try to carry everything alone. Independence protects your focus, but it can also hide solvable problems.",
    connection: "You connect best with capable, low-drama people who respect boundaries, enjoy precise conversation, and do not confuse closeness with constant access.",
  },
  "idea-monkey": {
    core: "Your mind creates links quickly and your social warmth helps those links travel. You enjoy testing possibilities in conversation, improvising around obstacles, and turning an ordinary moment into something more interesting.",
    strength: "Your signature strength is collaborative invention. You make experimentation feel inviting, spot unexpected combinations, and help a group escape the assumption that there is only one workable answer.",
    love: "In love, playfulness and curiosity keep you engaged. You want a partner who can laugh, explore, and talk freely while also helping everyday promises survive the next exciting idea.",
    career: "You shine in creative, fast-moving work: ideation, campaigns, facilitation, early product discovery, events, content, or roles that reward resourceful communication.",
    growth: "Choose a small number of ideas to finish. A simple capture-and-prioritize habit lets your originality produce visible results without asking you to become rigid.",
    caution: "Novelty can pull your attention away from maintenance, detail, or an earlier commitment. People may remember the unfinished promise more strongly than the brilliant start.",
    connection: "You connect best with curious people who enjoy spontaneity but are comfortable naming expectations and returning together to what still needs to be completed.",
  },
  "whim-fox": {
    core: "You are energized by freedom, challenge, and the possibility of a less obvious route. You trust direct experience, adapt quickly, and rarely accept a rule simply because it has existed for a long time.",
    strength: "Your signature strength is agile courage. You move when a window opens, question stale assumptions, and remain surprisingly inventive when a plan stops working.",
    love: "In love, chemistry needs room to breathe. You are drawn to confidence and authenticity, and you stay more present when commitment feels chosen rather than monitored.",
    career: "You fit entrepreneurial, competitive, or exploratory work where initiative matters: launching, selling, negotiating, troubleshooting, field work, or independent creative practice.",
    growth: "Build freedom on a reliable foundation. A few clear routines around money, time, and communication protect your options instead of restricting them.",
    caution: "Your resistance to constraint can activate before you know whether a boundary is reasonable. Leaving abruptly may preserve autonomy while creating consequences you did not intend.",
    connection: "You connect best with confident people who speak plainly, keep their own life, and can negotiate space without using distance as punishment.",
  },
  "dreamer-rabbit": {
    core: "You experience life through imagination and emotional meaning. Your inner world is rich, and your gentleness helps you notice possibilities in people that a more hurried observer could miss.",
    strength: "Your signature strength is tender imagination. You can create beauty, comfort, and fresh perspective while making others feel that their less polished feelings are welcome.",
    love: "In love, you long for emotional resonance and small signs of genuine care. You flourish with someone who treats your sensitivity respectfully and helps turn shared dreams into ordinary life.",
    career: "You thrive in humane creative work—storytelling, design, care, education, community, or flexible roles where empathy and original perspective have practical value.",
    growth: "Give your ideas a container. A gentle deadline, a visible next step, or a trusted collaborator can carry inspiration across the gap between imagining and making.",
    caution: "When reality feels harsh, you may delay a decision and live with the ideal version a little longer. Unspoken hopes can quietly become expectations that no one else knows about.",
    connection: "You connect best with kind, grounded people who enjoy your imagination, communicate consistently, and never use realism as an excuse for cynicism.",
  },
  "fantasy-cat": {
    core: "You follow a private aesthetic and notice details that do not register for everyone else. Your originality grows in unhurried solitude, where you can explore an interest without having to justify it too soon.",
    strength: "Your signature strength is uncompromised perspective. You protect the unusual detail, mood, or question that eventually gives a piece of work its distinctive character.",
    love: "In love, you need acceptance without intrusion. You can be deeply affectionate in your own rhythm and value a partner who notices your subtle gestures instead of demanding a scripted display.",
    career: "You excel in independent creative or specialist work: art, writing, curation, craft, research, concept development, or any role where taste and sustained fascination matter.",
    growth: "Translate a little more of your inner logic. You do not need to dilute your perspective; giving others one point of entry can help the right audience recognize it.",
    caution: "If you assume you will be misunderstood, you may disappear before anyone has a fair chance to understand. Mood can also decide the day unless you create a modest starting ritual.",
    connection: "You connect best with observant, nonjudgmental people who respect silence, are curious about your world, and do not treat individuality as a problem to solve.",
  },
  "caretaker-dog": {
    core: "You create trust through practical attention. You remember what people need, keep shared plans moving, and often become the person a group relies on without formally deciding that you would.",
    strength: "Your signature strength is responsive reliability. You combine warmth with organization, turning concern into the call, reminder, meal, checklist, or action that genuinely helps.",
    love: "In love, you are loyal and involved. You feel close through mutual care and everyday dependability, and you need your effort to be noticed rather than treated as an unlimited resource.",
    career: "You flourish in operations, service, coordination, healthcare, hospitality, people support, or team leadership where consistency and human awareness are equally important.",
    growth: "Ask whether help is wanted and name what you need in return. Care becomes more sustainable when it is an exchange rather than a role you can never leave.",
    caution: "You may prevent small difficulties so efficiently that others stop seeing the labor involved. Resentment can build when appreciation arrives only after you stop.",
    connection: "You connect best with appreciative, dependable people who contribute without being managed and who care for you before a crisis makes the need obvious.",
  },
  "brisk-tiger": {
    core: "You bring order, pace, and accountability to concrete goals. You prefer knowing what success looks like, assigning responsibility clearly, and solving the issue that is actually in front of you.",
    strength: "Your signature strength is operational command. You make decisions under pressure, maintain useful standards, and turn scattered effort into measurable progress.",
    love: "In love, you show commitment through protection, planning, and doing what needs to be done. A partner who communicates directly can help you remember that being heard is sometimes the solution.",
    career: "You are well suited to management, operations, delivery, finance, sales leadership, logistics, or any environment that rewards ownership, speed, and concrete results.",
    growth: "Distinguish between a performance problem and a human moment. Curiosity about context can preserve standards while bringing out better work and more honest communication.",
    caution: "Efficiency can become impatience when other people process slowly or indirectly. Correcting the method too quickly may reduce the ownership you want them to develop.",
    connection: "You connect best with straightforward, competent people who honor agreements, tolerate healthy friction, and can remind you to rest without becoming another task.",
  },
  "earnest-elephant": {
    core: "You are steady, conscientious, and quietly considerate. You prefer promises that can be kept, methods that have earned trust, and relationships in which care is demonstrated over time.",
    strength: "Your signature strength is durable integrity. You notice practical risk, preserve continuity, and keep doing careful work after the excitement around it has faded.",
    love: "In love, you build security through patience and loyalty. You may take time to verbalize emotion, but your consistency says a great deal to someone who knows how to read it.",
    career: "You thrive in roles that reward accuracy, service, stewardship, and accumulated knowledge: administration, quality, finance, care, technical support, or skilled practice.",
    growth: "Make your preferences visible before they become limits. A calm early request is easier for everyone than adapting silently until you can no longer continue.",
    caution: "Because you can endure discomfort, people may underestimate its cost. You may also remain loyal to an arrangement after its original purpose has disappeared.",
    connection: "You connect best with sincere, patient people who respect tradition without fearing change and who value the dependable forms your affection naturally takes.",
  },
  "steady-turtle": {
    core: "You trust careful progress and concrete evidence. You are comfortable working without applause, prefer a manageable pace, and often become exceptionally capable through repetition and close attention.",
    strength: "Your signature strength is self-contained mastery. You reduce error, protect resources, and keep essential work moving through patience rather than drama.",
    love: "In love, you value honesty, stability, and personal space. You are more likely to prove commitment through dependable behavior than through spontaneous emotional performance.",
    career: "You excel in craft, analysis, maintenance, engineering, accounting, production, or specialist roles where concentration and consistent quality matter more than visibility.",
    growth: "Share progress before the work is finished. Early communication prevents your independence from becoming isolation and gives others time to remove obstacles you cannot control.",
    caution: "You may accept too narrow a role because it is familiar and controllable. Caution is useful, but waiting for complete certainty can quietly make the decision for you.",
    connection: "You connect best with calm, capable people who respect routines and boundaries, communicate clearly, and do not manufacture urgency to create closeness.",
  },
  "smiley-panda": {
    core: "You make ordinary social space feel friendlier. You read the immediate mood, respond naturally, and help people relax without needing every interaction to become serious or productive.",
    strength: "Your signature strength is welcoming presence. You lower barriers, keep a group connected, and remind people that ease and enjoyment are meaningful parts of life.",
    love: "In love, you are affectionate, companionable, and happiest when warmth is woven into daily life. You need a partner who enjoys togetherness without making you responsible for every mood.",
    career: "You shine in people-facing, community, service, entertainment, hospitality, or collaborative roles where approachability and quick social judgment create value.",
    growth: "Let a little discomfort remain in the room. Naming a problem gently is often kinder than smoothing it over so successfully that it returns unchanged.",
    caution: "You may say yes to preserve a pleasant atmosphere, then discover that your real preference has vanished from the plan. Humor can also hide fatigue from both others and yourself.",
    connection: "You connect best with warm, emotionally responsible people who enjoy your lightness and are willing to hold serious conversations without making them punishing.",
  },
  "playful-raccoon": {
    core: "You respond quickly to the energy of the present moment. You are resourceful, independent, and good at making something happen with whatever is available right now.",
    strength: "Your signature strength is lively improvisation. You cut through overthinking, make bold experiments feel possible, and often discover the practical answer by moving first.",
    love: "In love, you want fun, honesty, and freedom from unnecessary rules. You stay engaged with a partner who can be spontaneous while communicating boundaries without games.",
    career: "You fit action-oriented work such as events, sales, production, field operations, entrepreneurship, performance, or fast problem-solving where adaptability beats long procedure.",
    growth: "Create a short pause between impulse and commitment. Checking time, cost, and who else is affected keeps your spontaneity powerful instead of expensive.",
    caution: "A boring obligation can become invisible until it becomes urgent. When cornered, you may defend your freedom first and examine your contribution to the problem later.",
    connection: "You connect best with lively, direct people who have their own momentum and can make clear agreements without trying to supervise your personality.",
  },
  "gentle-koala": {
    core: "You bring calm acceptance to people and places. You prefer a humane pace, rarely push yourself to the center, and often make it easier for others to be unguarded around you.",
    strength: "Your signature strength is restorative gentleness. You listen without escalating, notice simple comforts, and create stability that does not depend on control.",
    love: "In love, you value safety, ease, and affectionate routine. You open most fully with someone who is patient, consistent, and willing to ask rather than assume what you feel.",
    career: "You thrive in supportive, craft, care, administrative, or community roles with clear expectations, respectful relationships, and enough autonomy to maintain your rhythm.",
    growth: "Practice taking up a little more space. A preference stated early is not a burden; it is useful information that lets a relationship include the real you.",
    caution: "You can adapt quietly until your own limits become hard to locate. Avoiding conflict may create a calm surface while an important choice is being made without you.",
    connection: "You connect best with steady, considerate people who do not rush intimacy, appreciate peaceful companionship, and invite your opinion with genuine room for the answer.",
  },
  "solo-hedgehog": {
    core: "You protect your independence and evaluate life through direct, concrete experience. You do not need much social confirmation to know what works for you, and you are difficult to pressure into false enthusiasm.",
    strength: "Your signature strength is grounded self-possession. You stay practical, resist groupthink, and can continue alone when consensus is unavailable or unnecessary.",
    love: "In love, you need straightforward trust and substantial personal space. Your affection is real but understated, and you value a partner who does not turn constant contact into a loyalty test.",
    career: "You excel in autonomous, hands-on, technical, or specialist work where results speak clearly and unnecessary meetings do not interrupt concentration.",
    growth: "Tell trusted people what access looks like. Clear boundaries are easier to honor than unexplained distance, and one honest sentence can prevent many incorrect stories.",
    caution: "Self-protection can become automatic even when no one is trying to control you. If irritation is your only visible signal, people may miss the quieter need underneath it.",
    connection: "You connect best with independent, unpretentious people who respect silence, mean what they say, and do not require you to perform closeness on demand.",
  },
};

const TEMPERAMENT = {
  N: {
    label: "emotionally receptive",
    core: "Your emotional radar is highly responsive: you register changes in tone, risk, and atmosphere early, then process them in depth.",
    strength: "This sensitivity adds foresight and nuance to your type. You often notice the human consequence of a choice before it becomes obvious.",
    growth: "When the signal is strong, separate what you observed from what you inferred. Naming the difference helps intuition become guidance instead of worry.",
    caution: "Under strain, repeated mental review can keep a small uncertainty active long after more information would be useful.",
  },
  R: {
    label: "emotionally steady",
    core: "Your nervous system tends to return to baseline quickly. You can stay functional in uncertainty and are less likely to treat every change in atmosphere as an emergency.",
    strength: "This steadiness adds resilience and perspective to your type. Other people may borrow your calm when the situation becomes noisy or pressured.",
    growth: "Pause long enough to notice quieter emotions before moving on. Calm is most helpful when it includes the information that discomfort is trying to provide.",
    caution: "Under strain, you may minimize a concern because it does not feel urgent to you, even when someone else needs it acknowledged.",
  },
} as const;

const SCENARIOS: Record<BigFiveDimension, { high: string; low: string }> = {
  O: { high: "When plans change, you look for the new possibility before mourning the original route.", low: "When plans change, you first rebuild a clear, workable structure from what is still known." },
  C: { high: "With a distant deadline, you naturally map the stages and feel better once progress is visible.", low: "With a distant deadline, you keep options open and often find your strongest burst once the task becomes concrete." },
  E: { high: "In a new group, you understand the atmosphere by entering the conversation and testing the energy.", low: "In a new group, you observe first and usually prefer one meaningful exchange to broad circulation." },
  A: { high: "During disagreement, you instinctively search for language that protects both the relationship and the decision.", low: "During disagreement, you protect honesty and independence, even when the clearest answer creates temporary friction." },
  N: { high: "After an ambiguous message, you notice several possible meanings and may keep thinking until the tone feels resolved.", low: "After an ambiguous message, you tend to assume it can wait for context and continue with the rest of your day." },
};

type AxisInsight = {
  core: string;
  strength: string;
  love: string;
  career: string;
  growth: string;
  caution: string;
};

const AXIS_INSIGHTS: Record<
  BigFiveDimension,
  { high: AxisInsight; low: AxisInsight }
> = {
  O: {
    high: {
      core: "New ideas rarely stay abstract for long in your mind. You instinctively compare them, combine them, and imagine what else they could become.",
      strength: "You can give people a fresh angle when a familiar answer has stopped working. That imaginative range makes you especially useful at the beginning of change.",
      love: "A relationship feels alive when there is still something to discover together. Shared curiosity, honest conversation, and occasional novelty help you stay emotionally present.",
      career: "You contribute most when a role leaves room to question assumptions and improve the method. Repetition becomes easier when you understand the larger possibility it serves.",
      growth: "Not every possibility needs to remain open. Choosing one direction long enough to test it gives your imagination a chance to become something other people can use.",
      caution: "When the next idea arrives, routine work can suddenly feel smaller than it really is. The unfinished final ten percent may matter more to others than the exciting beginning.",
    },
    low: {
      core: "You understand the world through concrete evidence and lived experience. A clear example often tells you more than an elegant theory with no visible use.",
      strength: "You notice whether an idea can survive contact with ordinary life. That realism protects time, money, and attention from being spent on novelty alone.",
      love: "You build closeness through consistency and familiar rituals. Reliability, shared routines, and care that can be felt in daily life matter more than dramatic surprises.",
      career: "You are strongest where expectations are tangible and progress can be checked. Proven methods do not bore you when they continue to produce dependable results.",
      growth: "A new approach does not have to reject everything that already works. Try small experiments that preserve a stable foundation while giving change a fair chance.",
      caution: "An unfamiliar proposal may sound impractical before it has been fully explained. Asking for one concrete trial can reveal value that a first impression would miss.",
    },
  },
  C: {
    high: {
      core: "You feel calmer when responsibilities have a shape: a sequence, a standard, and a clear finish line. Keeping a promise is part of how you understand personal integrity.",
      strength: "You can turn intention into sustained effort. People learn that your yes usually means the work will still be moving after the first burst of enthusiasm fades.",
      love: "You often express care by remembering, preparing, and following through. A partner who notices that invisible labor will understand a large part of your emotional language.",
      career: "Planning, quality, and ownership are natural sources of credibility for you. You are often the person who sees the missing step before it becomes a public problem.",
      growth: "Leave a small margin for improvisation and rest. A plan that can bend is more durable than one that treats every change as a failure.",
      caution: "High standards can quietly become a rule that no one else knew they had agreed to. Explaining what matters most prevents care from being heard as control.",
    },
    low: {
      core: "You prefer enough structure to begin, then adjust through direct contact with the situation. Flexibility is not a lack of care; it is how you stay responsive.",
      strength: "You recover quickly when a plan becomes obsolete. While others are still defending the original schedule, you are often already finding a workable route forward.",
      love: "You bring spontaneity and breathing room to a relationship. Affection feels most genuine when it can respond to the day instead of following a script.",
      career: "Fast-moving environments can reveal your resourcefulness. You are good at solving the actual problem even when the official process no longer fits it.",
      growth: "Give future you one visible starting point: a calendar block, a short checklist, or a clearly named next action. Light structure protects your freedom from last-minute pressure.",
      caution: "Tasks without immediate emotional weight can disappear until they become urgent. A small promise may feel flexible to you while carrying real meaning for someone else.",
    },
  },
  E: {
    high: {
      core: "You often discover what you think by speaking, moving, and exchanging energy with other people. Participation sharpens your attention and makes possibilities feel real.",
      strength: "You can create momentum in a quiet room. Your visible engagement gives other people permission to contribute before everything is perfectly formed.",
      love: "Shared experiences and open expression help you feel connected. You tend to appreciate a partner who responds, participates, and lets affection have an audible voice.",
      career: "Conversation, coordination, and visible action are likely to bring out your best work. Long stretches without feedback can drain energy even when the task itself is meaningful.",
      growth: "Pause after making space and notice who has not entered it yet. Your energy becomes more inclusive when silence is allowed to contain an answer.",
      caution: "Enthusiasm can fill a conversation before a quieter person has found their opening. What feels like warmth to you may occasionally feel like pace or pressure to someone else.",
    },
    low: {
      core: "You usually understand a situation by observing before entering it. Solitude is not an absence of engagement; it is where your impressions become clear enough to trust.",
      strength: "You notice details that disappear in a louder exchange. Your restraint can make room for precision, depth, and the person who has not yet been heard.",
      love: "Closeness grows through safety, depth, and unhurried attention. You may prefer one honest conversation to a full calendar of social activity.",
      career: "Focused work and a degree of autonomy help you produce your best thinking. Meetings are useful when they resolve something that could not be handled more quietly.",
      growth: "Let trusted people see a thought before it is complete. A small early signal can prevent your need for processing time from being mistaken for distance.",
      caution: "Withdrawing protects concentration, but it can also leave other people inventing explanations for your silence. They may need a simple sign that the relationship is still secure.",
    },
  },
  A: {
    high: {
      core: "You naturally include the emotional effect of a decision in the decision itself. Cooperation feels intelligent to you because people do better work when trust remains intact.",
      strength: "You can sense what will help another person stay open rather than defensive. That instinct often lets you repair tension before it becomes a permanent story.",
      love: "Mutual consideration is central to your idea of love. You are generous with adjustment, but closeness lasts best when the other person adjusts for you as well.",
      career: "You strengthen teams by translating between different needs and keeping collaboration humane. People may bring you concerns they do not yet feel ready to say publicly.",
      growth: "Kindness becomes clearer when it includes a direct preference. Saying what you want early is often gentler than agreeing first and disappearing emotionally later.",
      caution: "You may preserve harmony so effectively that your own position vanishes from the room. Unspoken accommodation can eventually turn into fatigue or quiet resentment.",
    },
    low: {
      core: "You respect other people without automatically surrendering your own judgment. Honest disagreement can feel more trustworthy to you than politeness that hides the real decision.",
      strength: "You can name the issue others are circling around. That independence protects a group from comfortable consensus and gives difficult truths somewhere to stand.",
      love: "You value directness, autonomy, and affection that does not require constant agreement. A strong relationship can contain friction without treating it as rejection.",
      career: "You are useful where standards must survive social pressure. You can make a necessary call even when approval is not immediately available.",
      growth: "Add context before the conclusion. A brief sign that you understand the human impact helps your honesty land as respect rather than dismissal.",
      caution: "Efficiency or precision may sound colder than you intend. When people cannot see the care behind your conclusion, they may remember the edge more than the usefulness.",
    },
  },
  N: {
    high: {
      core: "Your attention registers subtle changes in mood, risk, and meaning. You often begin processing an experience while everyone else is still deciding whether anything changed.",
      strength: "Sensitivity gives you early information. You can anticipate emotional consequences, prepare for fragile points, and recognize what another person has not found words for yet.",
      love: "Tone and consistency carry real weight for you. Reassurance works best when it is specific, sincere, and followed by behavior that lets your nervous system believe it.",
      career: "You can spot weak signals before they become obvious problems. Work is easier to sustain when expectations are clear and there is space to recover after intense periods.",
      growth: "Separate the observation from the story it triggered. Writing down what you know, what you suspect, and what you can ask often turns worry back into useful intuition.",
      caution: "Uncertainty can stay active after the practical moment has passed. Repeated review may feel like preparation even when it is no longer producing new information.",
    },
    low: {
      core: "Your emotional system tends to return to baseline without demanding a long explanation. That steadiness helps you keep proportion when a situation becomes noisy.",
      strength: "You can lend calm to people who temporarily cannot find their own. Pressure is less likely to erase your ability to see the next practical step.",
      love: "You bring perspective and room to breathe into closeness. A partner may appreciate your stability while still needing you to pause and acknowledge a feeling before moving forward.",
      career: "You remain functional around uncertainty, criticism, and changing conditions. This makes you dependable in roles where other people need a stable reference point.",
      growth: "Notice the quieter signal before deciding that everything is fine. Emotional information can matter even when it does not arrive with urgency.",
      caution: "Because a concern does not stay loud inside you, you may underestimate how long it remains active for someone else. Calm can accidentally look like indifference without acknowledgment.",
    },
  },
};

function axisInsight(
  scores: Partial<Record<BigFiveDimension, number>>,
  dimension: BigFiveDimension,
): AxisInsight {
  return AXIS_INSIGHTS[dimension][(scores[dimension] ?? 5) >= 5 ? "high" : "low"];
}

type PairKey = "HH" | "HL" | "LH" | "LL";

function pairKey(
  scores: Partial<Record<BigFiveDimension, number>>,
  first: BigFiveDimension,
  second: BigFiveDimension,
): PairKey {
  return `${(scores[first] ?? 5) >= 5 ? "H" : "L"}${(scores[second] ?? 5) >= 5 ? "H" : "L"}` as PairKey;
}

const WORK_RHYTHM: Record<PairKey, string> = {
  HH: "Your imagination works best when it has a plan strong enough to carry it. You are capable of opening a new path and then building the systems that let other people follow it, although you may need to decide when an idea is complete enough to release.",
  HL: "You are often at your best in discovery: finding the surprising connection, testing an unconventional route, and adapting before the situation becomes fixed. A light external structure helps your strongest ideas survive beyond the moment that inspired them.",
  LH: "You prefer to make progress through a dependable method and a clearly understood standard. Because you are less tempted by novelty for its own sake, you can refine practical work until it becomes quietly excellent and unusually reliable.",
  LL: "You solve problems through contact with reality. Instead of designing the perfect system in advance, you notice what is available, make a workable move, and adjust; your challenge is leaving enough evidence behind that others can understand and repeat what worked.",
};

const SOCIAL_RHYTHM: Record<PairKey, string> = {
  HH: "You tend to make warmth visible. You enter the exchange, notice who needs including, and actively build a sense of togetherness; the important balance is remembering that you do not have to carry the emotional weather of the whole room.",
  HL: "You are socially direct and difficult to fake. People often appreciate the energy and honesty you bring, while your strongest relationships are the ones where lively disagreement is allowed to coexist with respect.",
  LH: "Your care is quieter than it is small. You often listen longer than other people expect, notice what has not been said, and offer support without turning the moment toward yourself; naming your own needs keeps that generosity mutual.",
  LL: "You value clean boundaries and low-pressure connection. You may not offer constant reassurance, but people who know you learn to trust the honesty, steadiness, and freedom from social performance that you bring.",
};

const PRESSURE_RHYTHM: Record<PairKey, string> = {
  HH: "Under pressure, preparation and sensitivity can reinforce each other: you notice what could go wrong and immediately try to prevent it. This creates impressive foresight, but it also means rest may feel undeserved until every possible risk has been handled.",
  HL: "You meet pressure with structure and proportion. Making a plan helps you remain calm, and other people may rely on you when the situation becomes disorganized; remember that a quiet emotional concern can still deserve attention even when the plan is working.",
  LH: "Pressure can arrive as a strong feeling before it becomes a clear plan. You are often highly responsive in the moment, but one small written next step can stop emotional urgency from having to organize the entire situation by itself.",
  LL: "You usually preserve flexibility when something goes wrong. Because you neither need a perfect plan nor stay emotionally activated for long, you can improvise freely; the risk is overlooking a consequence that will matter after the immediate moment has passed.",
};

const INTIMACY_RHYTHM: Record<PairKey, string> = {
  HH: "You are highly responsive to the emotional field between two people. You notice subtle changes, care about repairing disconnection, and may work hard to restore safety; love becomes easier when reassurance and responsibility travel in both directions.",
  HL: "You bring warmth without needing every feeling to become a crisis. This can make you a reassuring partner, especially when you pause long enough to show that your calm includes the other person’s experience rather than moving past it.",
  LH: "You may protect independence while privately feeling more than others realize. Direct questions, explicit agreements, and permission to process alone help you stay connected without feeling managed or emotionally exposed.",
  LL: "You prefer relationships with trust, room, and uncomplicated honesty. Your steadiness can make closeness feel secure, although a partner may occasionally need a more visible sign that your quiet confidence includes active care for the bond.",
};

const CHANGE_RHYTHM: Record<PairKey, string> = {
  HH: "You often process possibility in public: speaking an idea helps it gather shape and invites other people into the experiment. The best collaborators give you active feedback while also helping the group choose which exciting direction deserves sustained attention.",
  HL: "Your inner world may be more adventurous than your outward style suggests. You can spend a long time exploring an idea privately, then surprise people with how far your thinking has already traveled before you say a word.",
  LH: "You bring practical energy to change. Rather than debating every theoretical possibility, you prefer a concrete goal, visible participation, and a solution people can begin using now.",
  LL: "You tend to change quietly and for a reason. You observe, test the practical value of a new direction, and adopt it once it proves useful; this makes your commitment less flashy but often more durable.",
};

function pairedInsights(scores: Partial<Record<BigFiveDimension, number>>) {
  return {
    work: WORK_RHYTHM[pairKey(scores, "O", "C")],
    social: SOCIAL_RHYTHM[pairKey(scores, "E", "A")],
    pressure: PRESSURE_RHYTHM[pairKey(scores, "C", "N")],
    intimacy: INTIMACY_RHYTHM[pairKey(scores, "A", "N")],
    change: CHANGE_RHYTHM[pairKey(scores, "O", "E")],
  };
}

export type EnDetailedProfile = BaseProfile & {
  temperamentLabel: string;
  temperamentCore: string;
  temperamentStrength: string;
  temperamentGrowth: string;
  temperamentCaution: string;
};

export function enDetailedProfile(typeId: ThirtyTwoTypeId): EnDetailedProfile {
  const base = BASE_PROFILES[baseIdOf(typeId)];
  const temperament = TEMPERAMENT[nAxisOf(typeId)];
  return {
    ...base,
    temperamentLabel: temperament.label,
    temperamentCore: temperament.core,
    temperamentStrength: temperament.strength,
    temperamentGrowth: temperament.growth,
    temperamentCaution: temperament.caution,
  };
}

export function enScenarioLines(scores: Partial<Record<BigFiveDimension, number>>): string[] {
  return (["O", "C", "E", "A", "N"] as BigFiveDimension[]).map((dim) =>
    (scores[dim] ?? 5) >= 5 ? SCENARIOS[dim].high : SCENARIOS[dim].low,
  );
}

export function buildEnSelfSections(
  typeId: ThirtyTwoTypeId,
  scores: Partial<Record<BigFiveDimension, number>>,
): SelfSection[] {
  const profile = enDetailedProfile(typeId);
  const openness = axisInsight(scores, "O");
  const conscientiousness = axisInsight(scores, "C");
  const extraversion = axisInsight(scores, "E");
  const agreeableness = axisInsight(scores, "A");
  const paired = pairedInsights(scores);
  return [
    {
      title: "Your Alice Diagnosis",
      heading: "The way you naturally move through the world",
      body: `${profile.core}\n\n${openness.core} ${conscientiousness.core}\n\n${extraversion.core} ${agreeableness.core} ${paired.change}\n\n${profile.temperamentCore}`,
    },
    {
      title: "Handle with care",
      heading: "The pattern worth noticing",
      body: `${profile.caution}\n\n${profile.temperamentCaution}\n\n${conscientiousness.caution} ${agreeableness.caution} ${paired.pressure}\n\n${profile.growth} ${profile.temperamentGrowth}`,
    },
    {
      title: "Your best match",
      heading: "The kind of person who brings out your best",
      body: `${profile.connection} ${profile.love}\n\n${paired.intimacy} ${agreeableness.growth}`,
    },
  ];
}

export function buildEnDeepDiveSections(
  typeId: ThirtyTwoTypeId,
  scores: Partial<Record<BigFiveDimension, number>>,
  unlocked: boolean,
): ResolvedDeepDiveSection[] {
  const profile = enDetailedProfile(typeId);
  const openness = axisInsight(scores, "O");
  const conscientiousness = axisInsight(scores, "C");
  const extraversion = axisInsight(scores, "E");
  const agreeableness = axisInsight(scores, "A");
  const sensitivity = axisInsight(scores, "N");
  const paired = pairedInsights(scores);
  const gatedBlock = (heading: string, body: string) =>
    unlocked ? { heading, body } : { heading, body: "", locked: true };
  const loveBlocks = [
    {
      heading: "What makes you attractive in love",
      body: `${profile.love}\n\n${agreeableness.love}\n\n${extraversion.love}`,
      locked: false,
    },
    gatedBlock(
      "A manual for someone who falls for you",
      `${profile.connection}\n\n${conscientiousness.love}\n\n${paired.intimacy}`,
    ),
    gatedBlock(
      "What your partner may be quietly putting up with",
      `${sensitivity.caution}\n\n${agreeableness.caution} ${extraversion.caution}\n\n${profile.temperamentCaution} ${agreeableness.growth}`,
    ),
  ];
  const careerBlocks = [
    {
      heading: "How you work",
      body: `${profile.career}\n\n${conscientiousness.career}`,
      locked: false,
    },
    gatedBlock(
      "Work styles that fit you — and workplaces to avoid",
      `${openness.career}\n\n${paired.work}\n\n${profile.growth}`,
    ),
    gatedBlock(
      "Relationships at work",
      `${extraversion.career}\n\n${agreeableness.career}\n\n${sensitivity.career}\n\n${conscientiousness.growth}`,
    ),
  ];
  return [
    {
      key: "love",
      tab: "How you tend to love",
      note: "A closer look at connection, trust, and emotional pace.",
      body: loveBlocks
        .filter((block) => !block.locked)
        .map((block) => block.body)
        .join("\n\n"),
      blocks: loveBlocks,
      locked: false,
    },
    {
      key: "career",
      tab: "Work, purpose, and growth",
      note: "The environments where your strengths have room to work.",
      body: careerBlocks
        .filter((block) => !block.locked)
        .map((block) => block.body)
        .join("\n\n"),
      blocks: careerBlocks,
      locked: false,
    },
  ];
}

export function buildEnPartTwo(
  typeId: ThirtyTwoTypeId,
  scores: Partial<Record<BigFiveDimension, number>>,
  unlocked: boolean,
): ResolvedPartTwo {
  const profile = enDetailedProfile(typeId);
  const openness = axisInsight(scores, "O");
  const conscientiousness = axisInsight(scores, "C");
  const extraversion = axisInsight(scores, "E");
  const agreeableness = axisInsight(scores, "A");
  const sensitivity = axisInsight(scores, "N");
  const paired = pairedInsights(scores);
  return {
    likable: [
      profile.connection,
      paired.social,
      agreeableness.strength,
      extraversion.strength,
      profile.temperamentStrength,
    ],
    weapons: [
      { title: "Your signature strength", body: profile.strength },
      { title: "How you see what others miss", body: openness.strength },
      { title: "How you turn intention into action", body: conscientiousness.strength },
      { title: "The energy you bring", body: extraversion.strength },
      { title: "How you handle people", body: agreeableness.strength },
      { title: "Your emotional advantage", body: sensitivity.strength },
    ],
    dislikable: unlocked
      ? [
          { title: "A pattern others may misread", body: profile.caution },
          { title: "When possibility pulls you away", body: openness.caution },
          { title: "When standards become pressure", body: conscientiousness.caution },
          { title: "When your social pace differs", body: extraversion.caution },
          { title: "When honesty and harmony compete", body: agreeableness.caution },
          { title: "Under emotional pressure", body: sensitivity.caution },
        ]
      : null,
    relations: unlocked
      ? [
          { relation: "With friends", body: `${profile.connection} ${extraversion.love}` },
          { relation: "With a partner", body: `${profile.love} ${sensitivity.love}` },
          { relation: "With family", body: `${agreeableness.love} ${conscientiousness.love}` },
          { relation: "At work", body: `${profile.career} ${openness.career}` },
        ]
      : null,
    sceneCautions: unlocked
      ? [
          { scene: "With friends", body: `${extraversion.caution} ${profile.growth}` },
          { scene: "With a partner", body: `${sensitivity.caution} ${agreeableness.growth}` },
          { scene: "In your career", body: `${conscientiousness.caution} ${openness.growth}` },
          { scene: "With family", body: `${agreeableness.caution} ${profile.temperamentGrowth}` },
        ]
      : null,
    gapTeaser:
      "Your friends may notice strengths and habits that feel completely ordinary to you.",
    locked: !unlocked,
  };
}

type EnSceneRule = {
  title: string;
  chipLabel: string;
  color: string;
  gated: boolean;
  main: { dim: BigFiveDimension; high: string; low: string };
  spice: { dim: BigFiveDimension; high: string; low: string };
};

const EN_SCENES: readonly EnSceneRule[] = [
  {
    title: "When it is time for a group photo",
    chipLabel: "A group photo",
    color: "#F48BAE",
    gated: true,
    main: { dim: "E", high: "You naturally drift toward the center and loosen everyone up just before the shutter clicks.", low: "You choose a comfortable place near the edge and somehow end up with the most natural expression in the picture." },
    spice: { dim: "C", high: "You are also the person checking that nobody was cropped out.", low: "You may enjoy the moment so much that you forget to save the photo afterward." },
  },
  {
    title: "When a bee flies into the room",
    chipLabel: "A bee appears",
    color: "#4CAF7D",
    gated: false,
    main: { dim: "E", high: "You react out loud, then somehow become the person opening a window and directing the rescue operation.", low: "You go very still, track it carefully, and trust that becoming uninteresting is the safest strategy." },
    spice: { dim: "N", high: "Even after it leaves, part of your attention stays fixed on the window for a while.", low: "Once the immediate danger is gone, you return to what you were doing with impressive calm." },
  },
  {
    title: "When an elevator suddenly stops",
    chipLabel: "A stopped elevator",
    color: "#56BFE8",
    gated: false,
    main: { dim: "C", high: "You check the display and emergency button, then work through the practical steps in order.", low: "You look for a phone signal, assess the mood, and adapt to whatever information appears first." },
    spice: { dim: "A", high: "You are likely to reassure the other passengers before talking about your own concern.", low: "You avoid forced reassurance, and your matter-of-fact presence may calm the room anyway." },
  },
  {
    title: "When something feels wrong in a convenience store",
    chipLabel: "Something feels wrong",
    color: "#F2C14E",
    gated: false,
    main: { dim: "N", high: "You notice the change in atmosphere before most people can explain what is different.", low: "Your pulse stays surprisingly steady while you wait for enough facts to understand the situation." },
    spice: { dim: "C", high: "You quietly locate the exit and choose the safest next step.", low: "You rely on fast instinct, which can be remarkably accurate when there is no time for a full plan." },
  },
  {
    title: "When the lights go out unexpectedly",
    chipLabel: "A sudden blackout",
    color: "#56BFE8",
    gated: false,
    main: { dim: "E", high: "Your first reaction becomes part of the room’s soundtrack, and your energy helps turn panic into a shared moment.", low: "While everyone else reacts, you quietly switch on a light and become useful without announcing it." },
    spice: { dim: "O", high: "Your mind immediately starts imagining what the interruption might make possible.", low: "You begin estimating how long the disruption will last and what still needs to be done." },
  },
  {
    title: "When an aggressive stranger confronts you",
    chipLabel: "A tense encounter",
    color: "#F48BAE",
    gated: true,
    main: { dim: "A", high: "Your calm tone can lower the temperature before the situation gathers momentum.", low: "You keep your posture steady and refuse to offer the reaction the other person is trying to provoke." },
    spice: { dim: "E", high: "You are quick to move a friend out of the situation while keeping attention on yourself.", low: "You reduce your presence, prioritize safety, and leave without turning the moment into a contest." },
  },
  {
    title: "When someone cancels at the last minute",
    chipLabel: "Last-minute cancellation",
    color: "#4CAF7D",
    gated: true,
    main: { dim: "N", high: "For a moment, you review the conversation and wonder whether you missed a signal.", low: "You accept the change quickly and are often ready to reschedule before the other person finishes apologizing." },
    spice: { dim: "O", high: "The empty time soon becomes an invitation to invent a different plan.", low: "You restore the day by returning to a familiar routine that still feels dependable." },
  },
  {
    title: "If you found yourself on a deserted island",
    chipLabel: "A deserted island",
    color: "#F2C14E",
    gated: true,
    main: { dim: "C", high: "You establish priorities—water, shelter, food—and create order before spending energy.", low: "You explore, learn from the terrain, and build a survival plan from what the island actually offers." },
    spice: { dim: "A", high: "If others are there, you check everyone’s condition and become the group’s emotional base.", low: "You are comfortable scouting alone and may map more of the island than anyone expected." },
  },
  {
    title: "When you win a life-changing amount of money",
    chipLabel: "A lottery win",
    color: "#4CAF7D",
    gated: true,
    main: { dim: "C", high: "Before celebrating too loudly, you divide the money into safety, responsibility, and enjoyment.", low: "You let yourself make one vivid memory immediately and trust that the details can be organized afterward." },
    spice: { dim: "E", high: "You plan to keep it secret, but your excitement probably reaches one trusted friend.", low: "You can continue an ordinary day so convincingly that nobody suspects a thing." },
  },
  {
    title: "When an intruder enters your school or workplace",
    chipLabel: "An unexpected intruder",
    color: "#F48BAE",
    gated: true,
    main: { dim: "N", high: "You detect the unusual sound or atmosphere early and begin scanning for the safest route.", low: "You stay functional, wait for reliable information, and avoid spreading panic through guesses." },
    spice: { dim: "A", high: "Your attention quickly includes who nearby may need help moving to safety.", low: "You make a direct decision and act without waiting for the whole group to agree." },
  },
  {
    title: "One week before an important exam",
    chipLabel: "A week before an exam",
    color: "#56BFE8",
    gated: true,
    main: { dim: "C", high: "The plan already exists, and visible progress makes the final week feel manageable.", low: "You keep the pressure light until the task feels immediate, then call on a powerful burst of focus." },
    spice: { dim: "N", high: "You may prepare more than anyone else and still feel as though there is one crucial thing left to learn.", low: "Your steady nerves help you sleep while everyone else is still rewriting their notes." },
  },
  {
    title: "When you miss the last train home",
    chipLabel: "The last train is gone",
    color: "#F2C14E",
    gated: true,
    main: { dim: "O", high: "You quickly reframe the problem as an unexpected night and start looking for the most interesting workable option.", low: "You compare practical routes, prices, and opening hours until the least disruptive solution becomes clear." },
    spice: { dim: "A", high: "You may check everyone else’s way home before remembering to solve your own.", low: "You choose the option that makes sense for you and communicate it without adding unnecessary drama." },
  },
];

export function buildEnMoshimoScenes(
  scores: Partial<Record<BigFiveDimension, number>>,
  unlocked: boolean,
): MoshimoScene[] {
  const pick = (rule: EnSceneRule["main"]): string =>
    rule[(scores[rule.dim] ?? 5) >= 5 ? "high" : "low"];
  return EN_SCENES.map((scene) => {
    const locked = scene.gated && !unlocked;
    return {
      title: scene.title,
      chipLabel: scene.chipLabel,
      color: scene.color,
      body: locked ? "" : `${pick(scene.main)} ${pick(scene.spice)}`,
      locked,
    };
  });
}
