export const DYNAMIC_STAND_SECTION_NAME = '立ち絵設定';

// --- デフォルト値 (Defaults) ---
export const DEFAULT_HEAD_OFFSET = 35; // 画像上端からの距離 (%)
export const DEFAULT_EMOTE_Y_OFFSET = -5; // 吹き出し基準点からのエモートの位置 (vh相当)
export const DEFAULT_AUTO_X_RATIO = 0.4; // 立ち絵幅に対する吹き出しの横位置比率

// --- 設定関連 (Configuration) ---

export interface StandSetting {
  index: string;
  emote: string;
  imageIdentifier: string;
  imageWidth?: number;  // 元画像の幅
  imageHeight?: number; // 元画像の高さ
  headOffset?: number;  // 頭の位置 (0-100%, 上端からの距離)
  offsetX: number;
  offsetY: number;
  sidePreference?: 'auto' | 'left' | 'right';
}

export class StandGlobalConfig {
  slideWidth: number = 20;      // 押し出し幅 (vw)
  displayDuration: number = 5000; // 表示持続時間 (ms)
  animationDuration: number = 500; // アニメーション速度 (ms)
  standHeight: number = 60;     // 立ち絵の標準高さ (vh)
  standWidth: number = 20;      // 立ち絵の標準幅 (vw)
  edgeOffset: number = 0;       // 画面端からのオフセット (vw)
  emoteSize: number = 2.5;       // エモートの拡大率 (scale)
  typingSpeed: number = 60;      // 1文字あたりの表示速度 (ms)
}

export const DEFAULT_STAND_CONFIG = new StandGlobalConfig();

// --- アクター定義 (Actor Definition) ---

export interface StandingActor {
  characterId: string;
  side: 'left' | 'right';
  timestamp: number;
  expirationTime: number;
  imageIdentifier: string;
  width: number;
  height: number;
  speechText: string;
  speechVisible: boolean;
  speechOffsetX: number;
  speechOffsetY: number;
  emoteText: string;
  emoteVisible: boolean;
  emoteOffsetX: number;
  emoteOffsetY: number;
  opacity: number;
  left: number;
  isDisappearing?: boolean;
}