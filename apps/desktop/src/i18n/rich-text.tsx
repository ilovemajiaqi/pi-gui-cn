import { Fragment, type ReactNode } from "react";

/** React nodes substituted into `{name}` placeholders, e.g. an inline `<code>` span. */
export type TranslateNodes = Readonly<Record<string, ReactNode>>;

/**
 * Renders a message that carries inline markup: the same `{name}` placeholders
 * `interpolate()` fills with text, but each one is a React node the caller supplies.
 *
 * Keeping the whole sentence in one catalog entry is what makes word order
 * translatable — a language that puts the code sample before the instruction cannot be
 * served by concatenated fragments.
 */
export function interpolateNodes(template: string, nodes: TranslateNodes): ReactNode[] {
  const rendered: ReactNode[] = [];
  let cursor = 0;
  for (const match of template.matchAll(/\{(\w+)\}/g)) {
    const index = match.index ?? 0;
    if (index > cursor) rendered.push(template.slice(cursor, index));
    const name = match[1] ?? "";
    rendered.push(
      name in nodes ? <Fragment key={`${name}-${index}`}>{nodes[name]}</Fragment> : match[0],
    );
    cursor = index + match[0].length;
  }
  if (cursor < template.length) rendered.push(template.slice(cursor));
  return rendered;
}
