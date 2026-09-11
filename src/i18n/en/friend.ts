import type { BigFiveDimension } from "@/lib/types";

export const EN_FRIEND_QUESTIONS = [
  "{name} actively shares their opinions, even in a group.",
  "{name} tends to act as soon as an idea comes to mind.",
  "{name} often makes a plan before taking action.",
  "{name} has firm opinions and can be reluctant to give way.",
  "{name}'s emotional ups and downs are easy to notice in their expression or behavior.",
  "{name} seems good at sensing how other people feel.",
  "{name} sometimes surprises people with original ideas.",
  "{name} can naturally start a conversation with someone they have just met.",
  "{name} sometimes focuses on the moment and puts planning off until later.",
  "{name} seems to think things through carefully.",
  "{name} is more likely to listen than to lead the conversation.",
  "When {name} is around, the atmosphere often feels more relaxed.",
  "{name} readily steps into unfamiliar places or activities.",
  "Once {name} sets a goal, they work steadily toward it.",
  "{name} tends to prefer familiar places and activities.",
  "{name} often notices when someone is down and checks in on them.",
  "{name} tends to look at things from a practical point of view.",
  "{name} appears emotionally steady, with few dramatic ups and downs.",
  "{name} often reads the room and adjusts to the group.",
  "{name} listens to other people with a warm, welcoming expression.",
  "{name} seems strongly committed to finishing what they start.",
  "{name} tends to worry and quickly notices possible risks.",
  "{name} can stay calm and composed in tense situations.",
  "{name} keeps a cool head instead of being swept up by other people's emotions.",
  "{name} is good at keeping things organized and managing their schedule.",
  "{name} tends to trust their own judgment over the group's opinion.",
  "{name} enjoys abstract ideas and imagining possibilities.",
  "{name} values enjoying the present more than reaching a goal.",
  "Talking with {name} tends to brighten my mood too.",
  "{name} does not show much emotion on the surface.",
] as const;

export function enFriendQuestion(index: number, name: string): string {
  return (EN_FRIEND_QUESTIONS[index] ?? "").replaceAll("{name}", name);
}

export const EN_DIMENSIONS: Record<
  BigFiveDimension,
  { label: string; low: string; high: string }
> = {
  E: { label: "Extraversion", low: "Reserved", high: "Outgoing" },
  A: { label: "Agreeableness", low: "Independent", high: "Cooperative" },
  O: { label: "Openness", low: "Practical", high: "Imaginative" },
  C: { label: "Conscientiousness", low: "Flexible", high: "Organized" },
  N: { label: "Emotional sensitivity", low: "Steady", high: "Sensitive" },
};

export const EN_DIMENSION_ORDER: BigFiveDimension[] = ["E", "A", "O", "C", "N"];
