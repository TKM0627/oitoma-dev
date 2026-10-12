export function textInputError(value: string, limit: number): string | null {
  if (value.length > limit) return `入力は${limit.toLocaleString()}文字以内にしてください。`;
  // eslint-disable-next-line no-control-regex -- 制御文字の検出用。
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(value)) {
    return '制御文字・表示順を変える不可視文字を取り除いてください。';
  }
  return null;
}

export function assertTextInput(value: string, limit: number): void {
  const error = textInputError(value, limit);
  if (error) throw new RangeError(error);
}
