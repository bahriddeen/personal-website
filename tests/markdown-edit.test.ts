import { describe, expect, it } from 'vitest';
import {
  applyEdit,
  codeBlockEdit,
  continueListEdit,
  countWords,
  linePrefixEdit,
  linkEdit,
  wrapEdit,
  type Edit,
} from '@/lib/admin/markdown-edit';

/** Apply an edit and show the result with the new selection marked as [ ] or | for a caret. */
function show(value: string, edit: Edit): string {
  const next = applyEdit(value, edit);
  if (edit.selStart === edit.selEnd) return `${next.slice(0, edit.selStart)}|${next.slice(edit.selStart)}`;
  return `${next.slice(0, edit.selStart)}[${next.slice(edit.selStart, edit.selEnd)}]${next.slice(edit.selEnd)}`;
}

describe('bold / italic / code', () => {
  it('wraps the selection and keeps it selected', () => {
    expect(show('make this bold', wrapEdit('make this bold', 5, 9, '**', '**', 'bold text'))).toBe(
      'make **[this]** bold',
    );
  });

  it('inserts a selected placeholder when nothing is selected', () => {
    expect(show('a  b', wrapEdit('a  b', 2, 2, '_', '_', 'italic text'))).toBe('a _[italic text]_ b');
  });

  it('unwraps when pressed again, from inside or including the markers', () => {
    expect(show('make **this** bold', wrapEdit('make **this** bold', 7, 11, '**', '**', 'x'))).toBe(
      'make [this] bold',
    );
    expect(show('make **this** bold', wrapEdit('make **this** bold', 5, 13, '**', '**', 'x'))).toBe(
      'make [this] bold',
    );
  });
});

describe('links', () => {
  it('turns selected text into a link and selects the address to type', () => {
    expect(show('see docs here', linkEdit('see docs here', 4, 8))).toBe('see [docs]([https://]) here');
  });

  it('turns a selected URL into the target', () => {
    const v = 'go https://example.com now';
    expect(show(v, linkEdit(v, 3, 22))).toBe('go [[link text]](https://example.com) now');
  });

  it('inserts a template with nothing selected', () => {
    expect(show('', linkEdit('', 0, 0))).toBe('[[link text]](https://)');
  });
});

describe('line formats', () => {
  it('adds a heading to the whole line, wherever the caret is', () => {
    expect(show('intro\nTitle here\nmore', linePrefixEdit('intro\nTitle here\nmore', 9, 9, 'h2'))).toBe(
      'intro\n## Title here|\nmore',
    );
  });

  it('switches heading level instead of stacking, and toggles off', () => {
    expect(show('## Title', linePrefixEdit('## Title', 3, 3, 'h3'))).toBe('### Title|');
    expect(show('### Title', linePrefixEdit('### Title', 4, 4, 'h3'))).toBe('Title|');
  });

  it('numbers every selected line, and switches list type', () => {
    const v = 'one\ntwo\nthree';
    expect(show(v, linePrefixEdit(v, 0, v.length, 'ol'))).toBe('[1. one\n2. two\n3. three]');
    expect(applyEdit('- a\n- b', linePrefixEdit('- a\n- b', 0, 7, 'ol'))).toBe('1. a\n2. b');
    expect(applyEdit('- a\n- b', linePrefixEdit('- a\n- b', 0, 7, 'ul'))).toBe('a\nb');
  });

  it('leaves blank lines alone in a multi-line selection', () => {
    const v = 'a\n\nb';
    expect(applyEdit(v, linePrefixEdit(v, 0, v.length, 'quote'))).toBe('> a\n\n> b');
  });

  it('does not touch the next line when the selection ends at a line break', () => {
    const v = 'a\nb';
    expect(applyEdit(v, linePrefixEdit(v, 0, 2, 'ul'))).toBe('- a\nb');
  });
});

describe('code blocks', () => {
  it('fences the selection on lines of its own', () => {
    expect(show('see x = 1 here', codeBlockEdit('see x = 1 here', 4, 9))).toBe('see \n```\n[x = 1]\n```\n here');
  });

  it('names the language after the opening backticks', () => {
    expect(show('x = 1', codeBlockEdit('x = 1', 0, 5, 'python'))).toBe('```python\n[x = 1]\n```');
  });

  it('opens an empty block at the caret', () => {
    expect(show('', codeBlockEdit('', 0, 0))).toBe('```\n|\n```');
  });
});

describe('Enter in lists', () => {
  it('continues bullets, numbers, tasks and quotes', () => {
    expect(show('- milk', continueListEdit('- milk', 6)!)).toBe('- milk\n- |');
    expect(show('  9. nine', continueListEdit('  9. nine', 9)!)).toBe('  9. nine\n  10. |');
    expect(show('- [x] done', continueListEdit('- [x] done', 10)!)).toBe('- [x] done\n- [ ] |');
    expect(show('> said', continueListEdit('> said', 6)!)).toBe('> said\n> |');
  });

  it('ends the list on an empty item', () => {
    expect(show('- a\n- ', continueListEdit('- a\n- ', 6)!)).toBe('- a\n|');
  });

  it('leaves ordinary lines and the marker itself alone', () => {
    expect(continueListEdit('plain text', 10)).toBeNull();
    expect(continueListEdit('-not a list', 11)).toBeNull();
    expect(continueListEdit('- item', 1)).toBeNull();
  });
});

describe('word count', () => {
  it('counts prose words, not Markdown symbols or addresses', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('## Hello **world**')).toBe(2);
    expect(countWords('- one\n- two\n\n> three')).toBe(3);
    expect(countWords('See [the docs](https://example.com/a/b) and ![a cat](/c.png)')).toBe(6);
    expect(countWords('Salom dunyo — привет мир')).toBe(4);
  });
});
