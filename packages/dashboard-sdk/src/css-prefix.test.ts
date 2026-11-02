import { describe, expect, it } from 'vitest';

import {
  assertValidPrefix,
  checkClassPrefix,
  collectSelectors,
  describePrefixProblem,
} from './css-prefix';

const unprefixed = (css: string) => checkClassPrefix(css, 'ex').unprefixed;

describe('checkClassPrefix', () => {
  it.each([
    String.raw`.ex\:hidden{display:none}`,
    String.raw`.ex\:dark\:x:is(.dark *){color:red}`,
    String.raw`.ex\:space-y-4>:not(:last-child){margin:0}`,
    String.raw`:where(.ex\:space-y-4>:not(:last-child)){margin:0}`,
    String.raw`.ex\:grid-cols-\[auto_1fr\]{grid-template-columns:auto 1fr}`,
    String.raw`.ex\:w-1\.5{width:.375rem}`,
    String.raw`.ex\3a flex{display:flex}`,
    String.raw`.dark .ex\:x{color:red}`,
    String.raw`:root,:host{--ex-spacing:.25rem}`,
    '*,:before,:after,::backdrop{--tw-border-style:solid}',
  ])('accepts %s', (css) => {
    expect(unprefixed(css)).toEqual([]);
  });

  it.each([
    String.raw`.dark\:hidden`,
    '.-mt-2',
    String.raw`.\[mask-type\:alpha\]`,
    String.raw`.\@container`,
    '.hidden',
    ':where(.space-y-4>*)',
    String.raw`.ex\:x .hidden`,
    String.raw`.exx\:flex`,
    String.raw`.e\:flex`,
  ])('rejects %s', (selector) => {
    expect(unprefixed(`${selector}{display:none}`)).toEqual([selector]);
  });

  it('checks every selector of a list and of nested rules', () => {
    expect(unprefixed(String.raw`.ex\:a,.hidden,.ex\:b{color:red}`)).toEqual(['.hidden']);
    expect(
      unprefixed(String.raw`.ex\:card{color:red;.title{color:blue}&:hover{color:green}}`),
    ).toEqual(['.title']);
  });

  it('reads minified Tailwind output with at-rules', () => {
    const css = String.raw`@layer theme{:root,:host{--ex-spacing:.25rem}}@layer utilities{.ex\:flex{display:flex}@media (min-width:40rem){.ex\:md\:flex{display:flex}.md\:hidden{display:none}}@supports (display:grid){.grid{display:grid}}}@property --tw-x{syntax:"*";inherits:false}@keyframes spin{12.5%{opacity:.5}to{transform:rotate(360deg)}}`;
    expect(checkClassPrefix(css, 'ex')).toEqual({
      unprefixed: [String.raw`.md\:hidden`, '.grid'],
      prefixed: 2,
    });
  });

  it('ignores comments, strings and declarations', () => {
    const css = [
      '/*! tailwindcss v4.3.3 | MIT License | https://tailwindcss.com */',
      '/* .hidden { display: none } */',
      String.raw`.ex\:a::before{content:".hidden{";background:url(a.png)}`,
      String.raw`.ex\:b[data-file$=".pdf"]{color:red}`,
      "a[href*='x.com']{color:red}",
    ].join('\n');
    expect(unprefixed(css)).toEqual([]);
  });

  it('reports a selector once', () => {
    expect(unprefixed('.hidden{display:none}@media print{.hidden{display:block}}')).toEqual([
      '.hidden',
    ]);
  });
});

describe('collectSelectors', () => {
  it('skips at-rule preludes and splits lists outside parentheses', () => {
    expect(collectSelectors('@media (min-width:1px){a:is(.b,.c),d{x:y}}')).toEqual([
      'a:is(.b,.c)',
      'd',
    ]);
  });
});

describe('describePrefixProblem', () => {
  it('is undefined for a clean stylesheet', () => {
    expect(
      describePrefixProblem('a.css', 'ex', checkClassPrefix(String.raw`.ex\:a{x:y}`, 'ex')),
    ).toBeUndefined();
  });

  it('lists the offending selectors with the file and how to fix them', () => {
    const message = describePrefixProblem(
      'assets/src.css',
      'ex',
      checkClassPrefix(String.raw`.ex\:a{x:y}.card-title{x:y}.hidden{x:y}`, 'ex'),
    );
    expect(message).toContain('assets/src.css: 2 class selectors without the addon prefix "ex:"');
    expect(message).toContain('\n  .card-title\n  .hidden\n');
    expect(message).toContain('@utility');
  });

  it('cuts long lists', () => {
    const css = String.raw`.ex\:a{x:y}` + [...Array(25).keys()].map((i) => `.c${i}{x:y}`).join('');
    const message = describePrefixProblem('a.css', 'ex', checkClassPrefix(css, 'ex'))!;
    expect(message).toContain('  .c19\n  ... and 5 more');
    expect(message).not.toContain('.c20');
  });

  it('names a prefix that differs from the configured one', () => {
    const css = String.raw`.ins\:flex{x:y}.ins\:md\:hidden{x:y}.ins\:dark\:x:is(.dark *){x:y}`;
    const message = describePrefixProblem('a.css', 'ex', checkClassPrefix(css, 'ex'));
    expect(message).toMatch(/^a\.css: no class selector carries the configured prefix "ex:"/);
    expect(message).toContain('all of them start with "ins:"');
    expect(message).toContain("prefix: 'ins' in oakestraAddon()");
    expect(message).not.toContain('\n');
  });

  it('points at addon.css when nothing is prefixed', () => {
    const css = String.raw`.flex{x:y}.md\:hidden{x:y}.dark\:x{x:y}`;
    const message = describePrefixProblem('a.css', 'ex', checkClassPrefix(css, 'ex'));
    expect(message).toContain('no class selector carries the prefix "ex:" (3 without it');
    expect(message).toContain("@import 'tailwindcss/theme.css' layer(theme) prefix(ex);");
  });
});

describe('assertValidPrefix', () => {
  it('accepts lowercase letters', () => {
    expect(() => assertValidPrefix('ex')).not.toThrow();
  });

  it.each(['', 'Ex', 'ex1', 'my-addon', 'ex:', ' ex', undefined])('rejects %j', (prefix) => {
    expect(() => assertValidPrefix(prefix)).toThrow(/lowercase letters a-z only/);
  });
});
