import { MappingOptions } from '../service/plugin-mapper.service';

export interface RollResultChart {
  identifier: string;
  title: string;
  command: string;
  dice: string;
  value: string; // The table text
}

export interface RollResultChartRow {
  range: {
    start: number | null;
    end: number | null;
  };
  result: string;
}

export const ROLL_RESULT_CHART_TAG_NAME = 'roll-result-chart';
export const ROLL_RESULT_CHART_LIST_TAG_NAME = 'roll-result-chart-list';

export const ROLL_RESULT_CHART_MAPPING_OPTIONS: MappingOptions = {
  tagMap: { 'charts': ROLL_RESULT_CHART_LIST_TAG_NAME },
  arrayItemNames: { 'charts': ROLL_RESULT_CHART_TAG_NAME },
  attrProps: ['identifier', 'title', 'command', 'dice']
};
