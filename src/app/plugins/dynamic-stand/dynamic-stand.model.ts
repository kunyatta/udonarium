import { DataElement } from '@udonarium/data-element';

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
  imageWidth?: number;  // 追加: 元画像の幅
  imageHeight?: number; // 追加: 元画像の高さ
  headOffset?: number;  // 追加: 頭の位置 (0-100%, 上端からの距離)
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
  typingSpeed: number = 50;      // 1文字あたりの表示速度 (ms)
}

export const DEFAULT_STAND_CONFIG = new StandGlobalConfig();

// --- 統合オブジェクトモデル (Unified Object Model) ---

/**
 * 立ち絵、吹き出し、エモートを統合管理するためのデータ構造。
 * OverlayObject.content (DataElement) の中に格納される。
 */
export class StandingUnit {
  characterId: string = '';
  
  // ユニット全体の論理位置 (0が一番端、増えるごとに中央へ)
  stageIndex: number = 0;
  side: 'left' | 'right' = 'left';

  // コンポーネントの状態管理用
  state: 'appearing' | 'visible' | 'disappearing' = 'appearing';

  character: StandingCharacter = new StandingCharacter();
  speech: StandingSpeech = new StandingSpeech();
  emote: StandingEmote = new StandingEmote();
}

export class StandingCharacter {
  imageIdentifier: string = '';
  scaleX: number = 1.0; // 左右反転用 (-1.0 or 1.0)
  width: number = 20;   // vw
  height: number = 60;  // vh
}

export class StandingSpeech {
  text: string = '';
  isVisible: boolean = false;
  
  // キャラクター画像に対する相対位置 (px ではなく % 推奨だが、vw/vh基準の微調整値として保持)
  offsetX: number = 0; 
  offsetY: number = 0;
  
  typingSpeed: number = 50;
  targetLeft: number = 0; // アニメーション用（最終的なX座標）
  targetTop: number = 0;  // アニメーション用（最終的なY座標）
}

export class StandingEmote {
  text: string = ''; // 絵文字そのもの、またはアイコン名
  isVisible: boolean = false;
  scale: number = 1.0;
  
  // キャラクター画像に対する相対位置
  offsetX: number = 0;
  offsetY: number = 0;
}
