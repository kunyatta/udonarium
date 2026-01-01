import { DataElement } from '@udonarium/data-element';

export const DYNAMIC_STAND_SECTION_NAME = '立ち絵設定';

// --- 設定関連 (Configuration) ---

export interface StandSetting {
  index: string;
  emote: string;
  imageIdentifier: string;
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
  edgeOffset: number = 10;      // 画面端からのオフセット (vw)
  emoteSize: number = 2.5;       // エモートの拡大率 (scale)
  activeCharacterIds: string[] = []; // 立ち絵ONのキャラクターID
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
