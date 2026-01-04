import { MappingOptions } from '../service/plugin-mapper.service';

export interface RollResultChart {
  title: string; // Changed from 'name' to 'title' to avoid conflict with DataElement.name
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

export const ROLL_RESULT_CHART_MAPPING_OPTIONS: MappingOptions = {
  attrProps: ['title', 'command', 'dice']
};
