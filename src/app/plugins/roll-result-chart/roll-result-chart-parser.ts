import { StringUtil } from '@udonarium/core/system/util/string-util';
import { RollResultChartRow } from './roll-result-chart.model';

export class RollResultChartParser {
  /**
   * Parses the chart text into structured rows.
   * Format: "number:result", "start-end:result", "*-end:result", "start-*:result", or "*:result"
   */
  static parse(text: string): RollResultChartRow[] {
    if (!text) return [];

    const lines = text.split(/\r?\n/);
    const rows: RollResultChartRow[] = [];

    for (let line of lines) {
      const row = this.parseLine(line.trim());
      if (row) {
        rows.push(row);
      }
    }

    return rows;
  }

  private static parseLine(line: string): RollResultChartRow | null {
    const delimiterIndex = line.indexOf(':');
    const fullWidthDelimiterIndex = line.indexOf('：');
    const splitIndex = delimiterIndex >= 0 ? delimiterIndex : fullWidthDelimiterIndex;

    if (splitIndex <= 0) return null;

    const rangePart = line.substring(0, splitIndex).trim();
    const resultPart = line.substring(splitIndex + 1).trim();

    if (!rangePart || !resultPart) return null;

    const range = this.parseRange(rangePart);
    if (!range) return null;

    return {
      range,
      result: resultPart
    };
  }

  private static parseRange(rangeStr: string): { start: number | null; end: number | null } | null {
    const halfWidthRange = StringUtil.toHalfWidth(rangeStr).replace(/[ー—‐－~～]/g, '-')

    if (halfWidthRange === '*' || halfWidthRange === '**' || halfWidthRange === '*-*') {
      return { start: null, end: null };
    }

    if (halfWidthRange.includes('-')) {
      const parts = halfWidthRange.split('-');
      if (parts.length !== 2) return null;

      const startPart = parts[0].trim();
      const endPart = parts[1].trim();

      const start = startPart === '*' ? null : this.toNumber(startPart);
      const end = endPart === '*' ? null : this.toNumber(endPart);

      if (start === undefined || end === undefined) return null;

      if (start !== null && end !== null && start > end) {
        return { start: end, end: start };
      }

      return { start, end };
    }

    const num = this.toNumber(halfWidthRange);
    if (num === undefined) return null;

    return { start: num, end: num };
  }

  private static toNumber(val: string): number | undefined {
    if (!val) return undefined;
    const num = parseInt(val, 10);
    return isNaN(num) ? undefined : num;
  }
}