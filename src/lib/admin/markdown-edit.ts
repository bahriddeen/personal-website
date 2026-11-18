/**
 * Text edits behind the Markdown editor's toolbar and keyboard shortcuts. Pure functions:
 * each takes the text and the selection and says what to replace and what to select after,
 * so the editor can apply it as one undoable step.
 */

/** Replace `value.slice(start, end)` with `text`, then select `selStart`–`selEnd` (positions in the new text). */
export type Edit = { start: number; end: number; text: string; selStart: number; selEnd: number };

export function applyEdit(value: string, edit: Edit): string {
  return value.slice(0, edit.start) + edit.text + value.slice(edit.end);
}

/**
 * Bold, italic, inline code: wrap the selection, or unwrap it when it is already wrapped
 * (markers just outside the selection, or at both ends of it). With nothing selected a
 * placeholder is inserted and selected, ready to type over.
 */
export function wrapEdit(
  value: string,
  start: number,
  end: number,
  before: string,
  after: string,
  placeholder: string,
): Edit {
  const selected = value.slice(start, end);
  const b = before.length;
  const a = after.length;
  if (value.slice(start - b, start) === before && value.slice(end, end + a) === after) {
    return { start: start - b, end: end + a, text: selected, selStart: start - b, selEnd: end - b };
  }
  if (selected.length >= b + a && selected.startsWith(before) && selected.endsWith(after)) {
    const inner = selected.slice(b, selected.length - a);
    return { start, end, text: inner, selStart: start, selEnd: start + inner.length };
  }
  const inner = selected || placeholder;
  return { start, end, text: before + inner + after, selStart: start + b, selEnd: start + b + inner.length };
}

const URL_LIKE = /^(https?:\/\/|mailto:|\/)\S*$/i;

/** Link: selected text becomes the link text (URL selected next); a selected URL becomes the target. */
export function linkEdit(value: string, start: number, end: number): Edit {
  const selected = value.slice(start, end).trim() ? value.slice(start, end) : '';
  if (selected && URL_LIKE.test(selected)) {
    const label = 'link text';
    return { start, end, text: `[${label}](${selected})`, selStart: start + 1, selEnd: start + 1 + label.length };
  }
  const label = selected || 'link text';
  const url = 'https://';
  const text = `[${label}](${url})`;
  const urlAt = start + label.length + 3;
  // With text selected, the URL is what is left to type; otherwise start with the label.
  return selected
    ? { start, end, text, selStart: urlAt, selEnd: urlAt + url.length }
    : { start, end, text, selStart: start + 1, selEnd: start + 1 + label.length };
}

export type LineKind = 'h2' | 'h3' | 'quote' | 'ul' | 'ol';

const OWN: Record<LineKind, RegExp> = {
  h2: /^## +/,
  h3: /^### +/,
  quote: /^> ?/,
  ul: /^[-*+] +/,
  ol: /^\d+[.)] +/,
};
const HEADING = /^#{1,6} +/;
const LIST = /^(?:[-*+]|\d+[.)]) +/;

/**
 * Headings, quotes and lists apply to whole lines: every line the selection touches gets the
 * prefix, or loses it when they all have it already. Switching between heading levels or
 * between list types replaces the old prefix instead of stacking them.
 */
export function linePrefixEdit(value: string, start: number, end: number, kind: LineKind): Edit {
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  // A selection ending just after a line break does not include the next line.
  const last = end > start && value[end - 1] === '\n' ? end - 1 : end;
  const nl = value.indexOf('\n', last);
  const lineEnd = nl === -1 ? value.length : nl;
  const lines = value.slice(lineStart, lineEnd).split('\n');
  const filled = lines.filter((l) => l.trim() !== '');
  const remove = filled.length > 0 && filled.every((l) => OWN[kind].test(l));

  let n = 0;
  const next = lines.map((line) => {
    if (remove) return line.replace(OWN[kind], '');
    if (line.trim() === '' && lines.length > 1) return line;
    const bare =
      kind === 'h2' || kind === 'h3' ? line.replace(HEADING, '') : kind === 'quote' ? line : line.replace(LIST, '');
    n += 1;
    const prefix = kind === 'h2' ? '## ' : kind === 'h3' ? '### ' : kind === 'quote' ? '> ' : kind === 'ul' ? '- ' : `${n}. `;
    return prefix + bare;
  });
  const text = next.join('\n');
  // One line: caret at its end, ready to keep typing. Several: keep them selected.
  return lines.length === 1
    ? { start: lineStart, end: lineEnd, text, selStart: lineStart + text.length, selEnd: lineStart + text.length }
    : { start: lineStart, end: lineEnd, text, selStart: lineStart, selEnd: lineStart + text.length };
}

/**
 * Fenced code block on lines of its own around the selection (or an empty one to type in).
 * `language` goes after the opening backticks; without one the code is not highlighted.
 */
export function codeBlockEdit(value: string, start: number, end: number, language = ''): Edit {
  const selected = value.slice(start, end).replace(/\n$/, '');
  const lead = start > 0 && value[start - 1] !== '\n' ? '\n' : '';
  const trail = end < value.length && value[end] !== '\n' ? '\n' : '';
  const open = `${lead}\`\`\`${language}\n`;
  const text = `${open}${selected}\n\`\`\`${trail}`;
  const innerAt = start + open.length;
  return { start, end, text, selStart: innerAt, selEnd: innerAt + selected.length };
}

const CONTINUES = /^(\s*)(?:([-*+])|(\d+)([.)])|(>))( +)(\[[ xX]\] +)?/;

/**
 * Enter inside a list item or quote: start the next item (numbers count up, task boxes come
 * back unticked). Enter on an empty item ends the list instead. Null when Enter should just
 * insert a line break.
 */
export function continueListEdit(value: string, caret: number): Edit | null {
  const lineStart = value.lastIndexOf('\n', caret - 1) + 1;
  const nl = value.indexOf('\n', caret);
  const lineEnd = nl === -1 ? value.length : nl;
  const line = value.slice(lineStart, lineEnd);
  const m = CONTINUES.exec(line);
  if (!m || caret < lineStart + m[0].length) return null;

  if (line.slice(m[0].length).trim() === '') {
    // Empty item: drop its marker and stop the list.
    return { start: lineStart, end: lineEnd, text: '', selStart: lineStart, selEnd: lineStart };
  }
  const [, indent, bullet, num, delim, quote, space, task] = m;
  const marker = bullet ?? (num !== undefined ? `${Number(num) + 1}${delim}` : quote);
  const text = `\n${indent}${marker}${quote ? ' ' : space}${task ? '[ ] ' : ''}`;
  return { start: caret, end: caret, text, selStart: caret + text.length, selEnd: caret + text.length };
}

/** Words of prose, leaving out code fences' backticks, image addresses and Markdown symbols. */
export function countWords(markdown: string): number {
  const text = markdown
    .replace(/```[^\n]*\n?/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~|]/g, ' ')
    .replace(/(^|\s)[-+]\s/g, ' ');
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}
