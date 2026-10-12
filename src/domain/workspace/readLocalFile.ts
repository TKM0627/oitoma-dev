import { MAX_CODE_LENGTH } from '../diagnose/diagnosisEngine.ts';
import { assertTextInput } from '../security/textInput.ts';

export type InputKind = 'tex' | 'log';
export type FileEncoding = 'utf-8' | 'shift_jis';
export const MAX_LOG_LENGTH = 100_000;
export const FILE_BYTE_LIMITS = { tex: 64 * 1024, log: 256 * 1024 };

export async function readLocalFile(file: File, kind: InputKind, encoding: FileEncoding): Promise<string> {
  if (!['utf-8', 'shift_jis'].includes(encoding)) throw new Error('対応していない文字コードです。');
  if (!['tex', 'log'].includes(kind)) throw new Error('対応していないファイル種別です。');
  assertTextInput(file.name, 255);
  if (!file.name.toLowerCase().endsWith(`.${kind}`)) throw new Error(`.${kind}ファイルを選んでください。`);
  if (file.size > FILE_BYTE_LIMITS[kind]) throw new Error(`ファイルは${FILE_BYTE_LIMITS[kind] / 1024}KiB以内にしてください。`);
  const bytes = await file.arrayBuffer();
  // メタデータに加え、実際に読み込んだサイズも確認する。
  if (bytes.byteLength > FILE_BYTE_LIMITS[kind]) throw new Error('ファイルの容量上限を超えています。');
  let text: string;
  try { text = new TextDecoder(encoding, { fatal: true }).decode(bytes); }
  catch { throw new Error('選んだ文字コードで読み込めません。UTF-8／Shift_JISの設定を確認してください。'); }
  const limit = kind === 'tex' ? MAX_CODE_LENGTH : MAX_LOG_LENGTH;
  if (text.length > limit) throw new Error(`${kind === 'tex' ? 'ソース' : 'ログ'}は${limit.toLocaleString()}文字以内にしてください。内容は切り捨てず、読み込みを中止しました。`);
  assertTextInput(text, limit);
  return text;
}
