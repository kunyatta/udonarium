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
  keyword: '',
  audioIdentifier: '',
  audioMode: 'se',
  isLoop: false,
  stopJukebox: false
};
