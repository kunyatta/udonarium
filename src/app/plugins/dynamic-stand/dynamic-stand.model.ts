export const DYNAMIC_STAND_SECTION_NAME = '立ち絵設定';

export interface StandSetting {
  index: string;
  emote: string;
  imageIdentifier: string;
  offsetX: number;
  offsetY: number;
}

export class StandGlobalConfig {
  slideWidth: number = 20;      // 押し出し幅 (vw)
  displayDuration: number = 5000; // 表示持続時間 (ms)
  animationDuration: number = 500; // アニメーション速度 (ms)
  standHeight: number = 60;     // 立ち絵の標準高さ (vh)
  standWidth: number = 20;      // 立ち絵の標準幅 (vw)
  edgeOffset: number = 10;      // 画面端からのオフセット (vw)
  emoteSize: number = 2.5;       // エモートの拡大率 (scale)
  activeCharacterIds: string[] = []; // 立ち絵ONのキャラクターID
}

export const DEFAULT_STAND_CONFIG = new StandGlobalConfig();
