export interface CutIn {
  identifier: string;      // ユニークID (UUID)
  name: string;            // カットイン名
  imageIdentifier: string; // Udonariumの画像識別子
  duration: number;        // 表示時間 (秒)
  left: number;            // X座標 (%)
  top: number;             // Y座標 (%)
  width: number;           // 幅 (%)
  height: number;          // 高さ (%)
  opacity: number;         // 不透明度 (0.0-1.0)
  scale: number;           // スケール (倍率)
  keyword: string;         // チャット起動キーワード
  audioIdentifier: string; // 同時再生する音源識別子
}
