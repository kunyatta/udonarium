// combat-flow.constants.ts

// --- システム定数 ---
export const PLUGIN_ID = 'combat-flow';
export const FILE_NAME_HINT = 'default';
export const PERSISTENT_ID_TAG = '_combat_flow_persistent_id';

// --- ダメージ適用パネル関連 ---
export enum DamageApplyMode {
  AsIs = 'asis',
  Reduce = 'reduce',
  Halve = 'halve',
  Zero = 'zero',
  Custom = 'custom'
}

export const DEFAULT_DAMAGE_CHECK_CONFIG = {
  referenceParams: '防護', // デフォルトの参照パラメータ名
  buttonConfig: {
    showAsIs: true,
    showReduce: true,
    showHalve: true,
    showZero: false,
    showCustom: false
  }
};

// --- ナラティブログ関連 ---
export interface NarrativeMessageRule {
  synonyms: string[];
  templates: {
    positive: string;
    negative: string;
    zero: string;
  };
}

export const DEFAULT_NARRATIVE_RULES: NarrativeMessageRule[] = [
  {
    synonyms: ['HP', 'hp', 'ＨＰ', 'Hit Point', 'ヒットポイント', 'Life', '生命力'],
    templates: {
      positive: '{target} の {param} を {value} 点回復した！',
      negative: '{target} に {value} 点のダメージ！',
      zero: '{target} の {param} は変化しなかった。'
    }
  },
  {
    synonyms: ['MP', 'mp', 'ＭＰ', 'Magic Point', 'マジックポイント', 'Mental', '精神力'],
    templates: {
      positive: '{target} の {param} を {value} 点回復した！',
      negative: '{target} の {param} を {value} 点消費した。',
      zero: '{target} の {param} は変化しなかった。'
    }
  },
  {
    synonyms: ['SAN', 'san', 'ＳＡＮ', 'Sanity', '正気度'],
    templates: {
      positive: '{target} の {param} を {value} 点回復した！',
      negative: '{target} の {param} が {value} 点減少した。',
      zero: '{target} の {param} は変化しなかった。'
    }
  }
];
