import { describe, expect, it } from 'vitest';
import { isApprovedReferenceUrl } from './referencePolicy';

describe('管理対象の公開資料の参照先', () => {
  it.each([
    'https://www.overleaf.com/learn/latex/Mathematical_expressions',
    'https://docs.overleaf.com/writing-and-editing/inserting-images',
    'https://katex.org/docs/supported.html#letters',
    'https://github.com/abenori/jlreq/blob/master/README-ja.md',
    'https://www.learnlatex.org/ja/lesson-10',
    'https://www.gnu.org/software/emacs/manual/html_node/emacs/TeX-Mode.html',
    'https://tug.org/texlive/doc/texlive-en/texlive-en.html',
  ])('管理対象の公開資料を許可する: %s', (url) => {
    expect(isApprovedReferenceUrl(url)).toBe(true);
  });
  it.each([
    'not a URL', 'javascript:alert(1)',
    'https://www.overleaf.com.evil.example/learn/latex/Math',
    'https://www.overleaf.com@evil.example/learn/latex/Math',
    'https://user:password@www.overleaf.com/learn/latex/Math',
    'https://www.overleaf.com:8443/learn/latex/Math',
    'https://www.overleaf.com/learn/latex/Math?token=SECRET',
    'https://www.overleaf.com/project/private',
    'https://github.com/other/private/blob/main/README.md',
    'http://katex.org/docs/supported.html',
    'https://www.learnlatex.org.evil.example/ja/lesson-10',
    'https://www.learnlatex.org/ja/private',
    'https://www.gnu.org/software/other/private.html',
    'https://tug.org/private',
  ])('偽装・認証情報・非公開先・管理外のURLを拒否する: %s', (url) => {
    expect(isApprovedReferenceUrl(url)).toBe(false);
  });
});
