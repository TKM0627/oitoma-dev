import { MAX_LOG_LENGTH } from './readLocalFile.ts';
import { isOverfullWarning, isTexCommandMissing } from './logMessages.ts';
import { assertTextInput } from '../security/textInput.ts';

export type LogFinding = {
  message: string; severity: 'error' | 'warning'; logLine: number; context: string;
  reportedLine?: number; reportedFile?: string;
};
export const fileBasename = (path: string) => path.split(/[\\/]/).at(-1) || '';

/** ログの報告位置を読む。原因の位置とは限らない。 */
export function parseTexLog(log: string): { findings: LogFinding[]; limited: boolean } {
  assertTextInput(log, MAX_LOG_LENGTH);
  const lines = log.split('\n').map((line) => line.replace(/\r$/, ''));
  const findings: LogFinding[] = [];
  let limited = false;
  for (let i = 0; i < lines.length; i++) {
    const fileLine = /^(.+\.tex):(\d{1,7}):\s*(.+)$/i.exec(lines[i]);
    const error = /^!\s*(.+)$/.exec(lines[i]);
    const warning = /^(?:LaTeX|Package\s+\S+|Class\s+\S+)\s+Warning:\s*(.+)$/i.exec(lines[i]);
    const boxWarning = isOverfullWarning(lines[i]);
    const missingCommand = isTexCommandMissing(lines[i]);
    if (!fileLine && !error && !warning && !boxWarning && !missingCommand) continue;
    if (findings.length === 100) { limited = true; break; }
    let end = i + 1;
    while (end < lines.length && end < i + 8 && !/^!|^.+\.tex:\d+:|^(?:LaTeX|Package\s+\S+|Class\s+\S+)\s+Warning:/i.test(lines[end]) && !isOverfullWarning(lines[end]) && !isTexCommandMissing(lines[end])) end++;
    const context = lines.slice(i, end).join('\n').slice(0, 1200);
    const location = /(?:^|\n)l\.(\d{1,7})(?:\s|$)/.exec(context) || /on input line (\d{1,7})\b/.exec(context)
      || (boxWarning ? /at lines? (\d{1,7})\b/.exec(context) : null);
    const reportedLine = Number(fileLine?.[2] || location?.[1]);
    const message = (fileLine?.[3] || error?.[1] || warning?.[1] || lines[i]).slice(0, 500);
    const fileWarning = /^(?:LaTeX|Package\s+\S+|Class\s+\S+)\s+Warning:/i.test(message);
    findings.push({ message, severity: warning || boxWarning || fileWarning || isOverfullWarning(message) ? 'warning' : 'error', logLine: i + 1, context,
      ...(reportedLine > 0 ? { reportedLine } : {}), ...(fileLine ? { reportedFile: fileBasename(fileLine[1]) } : {}) });
    i = end - 1;
  }
  return { findings, limited };
}
