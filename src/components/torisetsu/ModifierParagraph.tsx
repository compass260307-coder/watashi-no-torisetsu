import {
  getModifierLabel,
  getModifierParagraph,
} from "@/lib/modifier-data";
import type {
  CModifier,
  NModifier,
  TorisetsuTypeId,
} from "@/lib/types";

interface ModifierParagraphProps {
  typeId: TorisetsuTypeId;
  cModifier: CModifier;
  nModifier: NModifier;
  accentColor?: string;
  className?: string;
}

export function ModifierParagraph({
  typeId,
  cModifier,
  nModifier,
  accentColor,
  className = "",
}: ModifierParagraphProps) {
  const label = getModifierLabel(cModifier, nModifier);
  const paragraph = getModifierParagraph(typeId, cModifier, nModifier);

  return (
    <div
      className={`rounded-2xl border p-5 sm:p-6 bg-label-bg ${className}`.trim()}
      style={
        accentColor
          ? {
              borderColor: `${accentColor}40`,
              background: `linear-gradient(to bottom, #ffffff, ${accentColor}10)`,
            }
          : undefined
      }
    >
      <div className="text-[10px] font-bold tracking-wider text-muted mb-2">
        あなたの個性
      </div>
      <div
        className="text-xl sm:text-2xl font-extrabold mb-3"
        style={accentColor ? { color: accentColor } : undefined}
      >
        {label}
      </div>
      <p className="text-sm leading-relaxed text-foreground whitespace-pre-line">
        {paragraph}
      </p>
    </div>
  );
}
