import type { BigFiveDimension } from "@/lib/types";
import type { ThirtyTwoTypeId } from "@/lib/thirty-two-types";

export const EN_RESULT_COPY = {
  metadataTitle: "My Personality Result | Alice Diagnosis",
  metadataDescription:
    "Your free Big Five personality result, explained through one of 32 character types.",
  heroLabel: "My personality type is",
  axesTitle: "My personality across five dimensions",
  axesDescription:
    "Each scale shows which side feels more natural to you right now. Neither side is better or worse.",
  restart: "Take the test again",
  allTypes: "Explore all 32 types",
  home: "Home",
} as const;

export type EnResultTypeCopy = {
  name: string;
  animal: string;
  essence: string;
  oneLiner: string;
};

export const EN_RESULT_TYPES: Record<ThirtyTwoTypeId, EnResultTypeCopy> = {
  "quiet-owl__N": { name: "Radiant Parakeet", animal: "Parakeet", essence: "Poet", oneLiner: "You turn feelings left unsaid into gentle, vivid words." },
  "quiet-owl__R": { name: "Steady Eagle", animal: "Eagle", essence: "Sage", oneLiner: "Your calm presence gives others clarity without needing many words." },
  "seeker-wolf__N": { name: "Swift Swallow", animal: "Swallow", essence: "Theorist", oneLiner: "Curiosity carries you far as you explore ideas in your own way." },
  "seeker-wolf__R": { name: "Cool Hawk", animal: "Hawk", essence: "Strategist", oneLiner: "You read the whole landscape and choose the smartest next move." },
  "dreamer-rabbit__N": { name: "Friendly Penguin", animal: "Penguin", essence: "Dreamer", oneLiner: "You fill your inner world with warmth, imagination, and care." },
  "dreamer-rabbit__R": { name: "Graceful Swan", animal: "Swan", essence: "Expressive Soul", oneLiner: "You express your own beauty quietly, without comparing yourself to others." },
  "fantasy-cat__N": { name: "Curious Crow", animal: "Crow", essence: "Collector", oneLiner: "You notice hidden treasures in places everyone else passes by." },
  "fantasy-cat__R": { name: "Easygoing Pelican", animal: "Pelican", essence: "Artisan", oneLiner: "You patiently refine what matters to you without being rushed." },
  "caretaker-dog__N": { name: "Caring Dog", animal: "Dog", essence: "Attendant", oneLiner: "You notice small changes in people and offer support before they ask." },
  "caretaker-dog__R": { name: "Dependable Horse", animal: "Horse", essence: "Coordinator", oneLiner: "You stay beside people and become a steady source of trust." },
  "brisk-tiger__N": { name: "Driven Tiger", animal: "Tiger", essence: "Coach", oneLiner: "You believe consistent effort is what turns ambition into results." },
  "brisk-tiger__R": { name: "Grounded Bear", animal: "Bear", essence: "Manager", oneLiner: "You remain centered under pressure and help stabilize the whole group." },
  "smiley-panda__N": { name: "Cheerful Panda", animal: "Panda", essence: "Director", oneLiner: "Your presence softens a tense room and helps people feel at ease." },
  "smiley-panda__R": { name: "Relaxed Elephant", animal: "Elephant", essence: "Optimist", oneLiner: "You genuinely trust that tomorrow can become a better day." },
  "playful-raccoon__N": { name: "Playful Raccoon", animal: "Raccoon", essence: "Pioneer", oneLiner: "You create the fun yourself and inspire everyone around you to move." },
  "playful-raccoon__R": { name: "Bold Rhino", animal: "Rhino", essence: "Challenger", oneLiner: "When others hesitate, you move forward and create momentum." },
  "sparkle-dolphin__N": { name: "Shimmering Jellyfish", animal: "Jellyfish", essence: "Companion", oneLiner: "You stay close to people's feelings and step into new worlds beside them." },
  "sparkle-dolphin__R": { name: "Cool-Headed Dolphin", animal: "Dolphin", essence: "Leader", oneLiner: "You unite different hopes and guide everyone toward the same dream." },
  "ambition-lion__N": { name: "Gentle Swordfish", animal: "Swordfish", essence: "Conductor", oneLiner: "You see the whole picture and move people into the roles where they shine." },
  "ambition-lion__R": { name: "Majestic Orca", animal: "Orca", essence: "General", oneLiner: "You see the larger field and lead with judgment that does not waver." },
  "idea-monkey__N": { name: "Dreamy Clownfish", animal: "Clownfish", essence: "Journalist", oneLiner: "You find what moves the heart and carry it to someone in your own words." },
  "idea-monkey__R": { name: "Easygoing Seal", animal: "Seal", essence: "Festival Star", oneLiner: "You brighten the atmosphere in an instant and pull everyone into the fun." },
  "whim-fox__N": { name: "Free-Spirited Octopus", animal: "Octopus", essence: "Rhetorician", oneLiner: "Your words draw people in and move them without forcing the moment." },
  "whim-fox__R": { name: "Independent Shark", animal: "Shark", essence: "Revolutionary", oneLiner: "You question convention and make a clear path toward the future you believe in." },
  "earnest-elephant__N": { name: "Pure-Hearted Unicorn", animal: "Unicorn", essence: "Idealist", oneLiner: "You refuse to let go of the ideals that make the world feel kinder." },
  "earnest-elephant__R": { name: "Steadfast Dragon", animal: "Dragon", essence: "Guardian", oneLiner: "Once you decide what matters, you protect it with unwavering strength." },
  "steady-turtle__N": { name: "Aspiring Pegasus", animal: "Pegasus", essence: "High-Flyer", oneLiner: "Without asking for attention, you keep reaching quietly toward something higher." },
  "steady-turtle__R": { name: "Resilient Phoenix", animal: "Phoenix", essence: "Survivor", oneLiner: "However many times you fall, you find the strength to rise again." },
  "gentle-koala__N": { name: "Thoughtful Angel", animal: "Angel", essence: "Aesthete", oneLiner: "Wishing for another person's happiness is one of your deepest joys." },
  "gentle-koala__R": { name: "Immovable Golem", animal: "Golem", essence: "Connoisseur", oneLiner: "You want to love what matters to you quietly, deeply, and without hurry." },
  "solo-hedgehog__N": { name: "Shy Ghost", animal: "Ghost", essence: "Detective", oneLiner: "You may say very little, yet somehow you notice almost everything." },
  "solo-hedgehog__R": { name: "Carefree Skeleton", animal: "Skeleton", essence: "Maverick", oneLiner: "Unbound by expectations, you move through life in your own wind." },
};

export type EnResultAxis = {
  dim: BigFiveDimension;
  title: string;
  left: string;
  right: string;
  color: string;
  lowDescription: string;
  highDescription: string;
};

export const EN_RESULT_AXES: readonly EnResultAxis[] = [
  { dim: "O", title: "Openness", left: "Practical", right: "Exploratory", color: "#E4AE3A", lowDescription: "You find confidence in familiar ideas and proven, concrete experience.", highDescription: "You are drawn to new ideas, experiences, and different ways of seeing things." },
  { dim: "C", title: "Conscientiousness", left: "Flexible", right: "Organized", color: "#88619A", lowDescription: "You adapt to the moment instead of forcing everything into a fixed plan.", highDescription: "You like to structure your goals and feel satisfied when you follow through." },
  { dim: "E", title: "Extraversion", left: "Reserved", right: "Outgoing", color: "#4298B4", lowDescription: "You recharge through quiet time and prefer a few deeper relationships.", highDescription: "Conversation and shared activity energize you and sharpen your thinking." },
  { dim: "A", title: "Agreeableness", left: "Independent", right: "Cooperative", color: "#33A474", lowDescription: "You value relationships while still making honest judgments by your own standards.", highDescription: "You notice people's feelings and naturally look for a harmonious way forward." },
  { dim: "N", title: "Emotional sensitivity", left: "Steady", right: "Sensitive", color: "#F25E62", lowDescription: "You tend to regain your balance quickly when something unexpected happens.", highDescription: "You notice subtle emotional changes and think deeply about what matters." },
];
