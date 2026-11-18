/**
 * Languages offered by the editor's code-block menu. `id` is what goes after the opening
 * backticks; every id here is highlighted by src/lib/markdown.ts (tests/code-languages.test.ts
 * checks that), except "text", which is deliberately left plain.
 */
export const CODE_LANGUAGES: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'ts', label: 'TypeScript' },
  { id: 'js', label: 'JavaScript' },
  { id: 'tsx', label: 'TSX' },
  { id: 'jsx', label: 'JSX' },
  { id: 'python', label: 'Python' },
  { id: 'bash', label: 'Shell' },
  { id: 'sql', label: 'SQL' },
  { id: 'json', label: 'JSON' },
  { id: 'yaml', label: 'YAML' },
  { id: 'html', label: 'HTML' },
  { id: 'css', label: 'CSS' },
  { id: 'scss', label: 'SCSS' },
  { id: 'go', label: 'Go' },
  { id: 'rust', label: 'Rust' },
  { id: 'swift', label: 'Swift' },
  { id: 'kotlin', label: 'Kotlin' },
  { id: 'java', label: 'Java' },
  { id: 'csharp', label: 'C#' },
  { id: 'c', label: 'C' },
  { id: 'cpp', label: 'C++' },
  { id: 'dart', label: 'Dart' },
  { id: 'ruby', label: 'Ruby' },
  { id: 'php', label: 'PHP' },
  { id: 'graphql', label: 'GraphQL' },
  { id: 'toml', label: 'TOML' },
  { id: 'dockerfile', label: 'Dockerfile' },
  { id: 'diff', label: 'Diff' },
  { id: 'md', label: 'Markdown' },
  { id: 'text', label: 'Plain text' },
];

export const DEFAULT_CODE_LANGUAGE = 'ts';
