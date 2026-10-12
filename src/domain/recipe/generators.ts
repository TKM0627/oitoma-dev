export type OptionValues = Record<string, string | number | boolean>;
type Generator = (options: OptionValues) => string;

export const generators: Record<string, Generator> = {
  subscript: (o) => `x_{${o.index}}`,
  superscript: (o) => `x^{${o.power}}`,
  fraction: (o) => `${o.style}{${o.numerator}}{${o.denominator}}`,
  root: (o) => o.degree === '2' ? `\\sqrt{${o.body}}` : `\\sqrt[${o.degree}]{${o.body}}`,
  sum: (o) => `\\sum_{${o.start}}^{${o.end}} ${o.body}`,
  integral: (o) => `${o.bounded ? '\\int_{0}^{1}' : '\\int'} ${o.body}\\,\\mathrm{d}x`,
  matrix: (o) => {
    const cells = o.entries === 'identity' ? ['1', '0', '0', '1'] : ['a', 'b', 'c', 'd'];
    return `\\begin{${o.bracket}}\n  ${cells[0]} & ${cells[1]} \\\\\n  ${cells[2]} & ${cells[3]}\n\\end{${o.bracket}}`;
  },
  cases: (o) => `f(x) = \\begin{cases}\n  ${o.function === 'absolute' ? 'x & x \\geq 0 \\\\\n  -x & x < 0' : '1 & x \\geq 0 \\\\\n  0 & x < 0'}\n\\end{cases}`,
  aligned: (o) => `\\begin{aligned}\n  ${o.example === 'system' ? 'x + y &= 3 \\\\\n  x - y &= 1' : '(a+b)^2 &= a^2 + 2ab + b^2 \\\\\n          &= (a+b)(a+b)'}\n\\end{aligned}`,
  symbols: (o) => `${o.symbol}${o.relation === 'none' ? '' : ` ${o.relation} 0`}`,
};
