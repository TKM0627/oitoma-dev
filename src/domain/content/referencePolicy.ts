// ホストの部分一致では認可しない。
export function isApprovedReferenceUrl(value: string): boolean {
  let url: URL;
  try { url = new URL(value); } catch { return false; }
  if (url.href !== value || /[\s\\]/u.test(value)) return false;
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search) return false;
  if (url.hostname === 'www.overleaf.com') return url.pathname.startsWith('/learn/latex/')
    || url.pathname === '/latex/learn/free-online-introduction-to-latex-part-1.pdf';
  if (url.hostname === 'docs.overleaf.com') return url.pathname.startsWith('/writing-and-editing/')
    || url.pathname.startsWith('/getting-started/') || url.pathname.startsWith('/troubleshooting-and-support/');
  if (url.hostname === 'katex.org') return url.pathname.startsWith('/docs/');
  if (url.hostname === 'www.latex-project.org') return url.pathname === '/help/documentation/amsldoc.pdf';
  if (url.hostname === 'www.learnlatex.org') return [
    '/ja/lesson-02', '/ja/lesson-03', '/ja/lesson-04', '/ja/lesson-07',
    '/ja/lesson-08', '/ja/lesson-09', '/ja/lesson-10', '/ja/lesson-12', '/ja/lesson-15',
  ].includes(url.pathname);
  if (url.hostname === 'www.gnu.org') return ['/software/emacs/manual/html_node/emacs/TeX-Mode.html', '/software/emacs/manual/html_mono/emacs.html', '/software/auctex/manual/auctex/Starting-a-Command.html'].includes(url.pathname);
  if (url.hostname === 'tug.org') return ['/texlive/doc/texlive-en/texlive-en.html', '/texinfohtml/web2c.html'].includes(url.pathname);
  if (url.hostname === 'texfaq.org') return ['/FAQ-altabcr', '/FAQ-noline', '/FAQ-overfull'].includes(url.pathname);
  return url.hostname === 'github.com' && url.pathname === '/abenori/jlreq/blob/master/README-ja.md';
}
