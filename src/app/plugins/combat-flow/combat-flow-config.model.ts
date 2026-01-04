import { DEFAULT_DAMAGE_CHECK_CONFIG } from './combat-flow.constants';

export class DamageCheckButtonConfig {
  showAsIs: boolean = true;
  showReduce: boolean = true;
  showHalve: boolean = true;
  showZero: boolean = true;
  showCustom: boolean = true;
}

export class DamageCheckConfig {
  referenceParams: string = '防護点';
  buttonConfig: DamageCheckButtonConfig = new DamageCheckButtonConfig();
}

/**
 * 戦闘フロープラグインの全体設定を保持するモデル
 */
export class CombatFlowConfig {
  // 戦闘パネルでの表示タグ (例: "HP MP")
  displayDataTags: string = 'HP MP';
  
  // システムログの送信元キャラクター名
  systemLogSenderName: string = '';

  // ダメージ適用確認パネルの設定
  damageCheckConfig: DamageCheckConfig = new DamageCheckConfig();

  constructor() {
    // デフォルト値の適用
    this.damageCheckConfig.referenceParams = DEFAULT_DAMAGE_CHECK_CONFIG.referenceParams;
    Object.assign(this.damageCheckConfig.buttonConfig, DEFAULT_DAMAGE_CHECK_CONFIG.buttonConfig);
  }
}
