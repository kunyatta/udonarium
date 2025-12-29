export interface CutIn {
  identifier: string;      // ユニークID (UUID)
  name: string;            // カットイン名
  type?: 'image' | 'video';// カットインの種類 (省略時はimage)
  imageIdentifier: string; // Udonariumの画像識別子
  videoIdentifier?: string;// YouTube Video ID
  duration: number;        // 表示時間 (秒)
  left: number;            // X座標 (%)
  top: number;             // Y座標 (%)
  width: number;           // 幅 (%)
  height: number;          // 高さ (%)
  opacity: number;         // 不透明度 (0.0-1.0)
  scale: number;           // スケール (倍率)
  // 登場演出設定
  inDuration: number;      // 登場アニメーション時間 (ms)
  easing: string;          // イージング
  startLeft: number;       // 開始X座標 (%)
  startTop: number;        // 開始Y座標 (%)
  startOpacity: number;    // 開始不透明度
  startScale: number;      // 開始スケール
  // 退場演出設定
  outDuration: number;     // 退場アニメーション時間 (ms)
  outEasing: string;       // 退場イージング
  endLeft: number;         // 終了X座標 (%)
  endTop: number;          // 終了Y座標 (%)
  endOpacity: number;      // 終了不透明度
  endScale: number;        // 終了スケール
  keyword: string;         // チャット起動キーワード
  audioIdentifier: string; // 同時再生する音源識別子
  audioMode: 'none' | 'se' | 'bgm'; // 再生モード
  isLoop: boolean;         // ループ再生するか (SEモード用)
  stopJukebox: boolean;    // 再生時にBGMを停止するか
}

export const DEFAULT_CUT_IN: Omit<CutIn, 'identifier'> = {
  name: '新規カットイン',
  type: 'image',
  imageIdentifier: '',
  videoIdentifier: '',
  duration: 5,
  left: 50,
  top: 50,
  width: 30,
  height: 0,
  opacity: 1.0,
  scale: 1.0,
  inDuration: 500,
  easing: 'ease-out',
  startLeft: 50,
  startTop: 50,
  startOpacity: 0,
  startScale: 1.0,
  outDuration: 500,
  outEasing: 'ease-in',
  endLeft: 50,
  endTop: 50,
  endOpacity: 0,
  endScale: 1.0,
  keyword: '',
  audioIdentifier: '',
  audioMode: 'se',
  isLoop: false,
  stopJukebox: false
};
