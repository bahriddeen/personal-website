import { describe, expect, it } from 'vitest';
import { CODE_LANGUAGES, DEFAULT_CODE_LANGUAGE } from '@/lib/code-languages';
import { renderMarkdown } from '@/lib/markdown';

/** A line of each language with something a highlighter colours (keyword, string, tag…). */
const SAMPLES: Record<string, string> = {
  ts: 'const total: number = 1;',
  js: 'const total = "one";',
  tsx: 'const el = <div className="a">hi</div>;',
  jsx: 'const el = <div className="a">hi</div>;',
  python: 'def add(a, b):\n    return a + b',
  bash: 'echo "hello" && exit 1',
  sql: 'SELECT slug FROM posts WHERE id = 1;',
  json: '{ "a": 1, "b": true }',
  yaml: 'name: "site"\nport: 3000',
  html: '<div class="card">Hi</div>',
  css: 'a { color: red; }',
  scss: '$gap: 4px;\n.a { margin: $gap; }',
  go: 'func main() { fmt.Println("hi") }',
  rust: 'fn main() { let x = 1; }',
  swift: 'let name: String = "hi"',
  kotlin: 'val name: String = "hi"',
  java: 'public class A { int x = 1; }',
  csharp: 'public class A { int x = 1; }',
  c: 'int main(void) { return 0; }',
  cpp: 'int main() { return 0; }',
  dart: 'void main() { print("hi"); }',
  ruby: 'def greet(name)\n  "hi #{name}"\nend',
  php: '<?php echo "hi"; ?>',
  graphql: 'query { post(id: 1) { title } }',
  toml: 'name = "site"\nport = 3000',
  dockerfile: 'FROM node:20\nRUN npm ci',
  diff: '- old line\n+ new line',
  md: '# Title\n\n**bold**',
};

describe('code-block languages', () => {
  it('offers a sample for every language in the editor menu', () => {
    for (const { id } of CODE_LANGUAGES) {
      if (id !== 'text') expect(SAMPLES[id], id).toBeDefined();
    }
    expect(CODE_LANGUAGES.some((l) => l.id === DEFAULT_CODE_LANGUAGE)).toBe(true);
  });

  it.each(CODE_LANGUAGES.filter((l) => l.id !== 'text').map((l) => [l.label, l.id]))(
    'highlights %s',
    async (_label, id) => {
      const html = await renderMarkdown(`\`\`\`${id}\n${SAMPLES[id]}\n\`\`\``);
      expect(html).toContain('class="token');
    },
  );

  it('leaves plain text and unknown languages uncoloured', async () => {
    expect(await renderMarkdown('```text\nconst a = 1;\n```')).not.toContain('class="token');
    expect(await renderMarkdown('```nonsense\nconst a = 1;\n```')).not.toContain('class="token');
  });

  it('understands common aliases', async () => {
    const aliases: Record<string, string> = {
      cs: SAMPLES.csharp,
      rb: SAMPLES.ruby,
      gql: SAMPLES.graphql,
      sh: SAMPLES.bash,
      py: SAMPLES.python,
      yml: SAMPLES.yaml,
    };
    for (const [alias, code] of Object.entries(aliases)) {
      expect(await renderMarkdown(`\`\`\`${alias}\n${code}\n\`\`\``), alias).toContain('class="token');
    }
  });
});
