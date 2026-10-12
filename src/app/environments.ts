export const environments = {
  none: '未選択',
  linux: 'Linux / Emacs',
  windows: 'Windows / TeX Live',
  other: 'その他のエディタ',
};
export type Environment = keyof typeof environments;
