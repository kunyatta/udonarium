import { SyncObject, SyncVar } from '@udonarium/core/synchronize-object/decorator';
import { ObjectNode } from '@udonarium/core/synchronize-object/object-node';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';

export interface Effect {
  type: 'attributeChange' | 'buffDebuff'; // 現時点では attributeChange と buffDebuff のみ
  target: string; // パラメータ名 (例: 'HP')
  value: number;  // 変化量 (例: -5)
  timing?: 'everyRound' | 'once'; // 効果のタイミング (毎ラウンドか、一回だけか)
  // 将来的に trigger: 'onRoundUpdate' なども追加可能
}

@SyncObject('StatusEffect')
export class StatusEffect extends ObjectNode {
  @SyncVar() persistentId: string = '';    // セッションをまたいでユニークなID
  @SyncVar() name: string = '新しい効果';      // 例: "死亡", "毒"
  @SyncVar() icon: string = '';            // emoji との互換性のため残すが、基本は emoji を使う
  @SyncVar() emoji: string = '✨';           // 絵文字アイコン
  @SyncVar() initialRounds: number = -1;   // 初期持続時間（-1は永続）

  // ★★★ START: Debug code for tracking remainingRounds changes ★★★
  @SyncVar() private _remainingRounds: number = -1;

  get remainingRounds(): number {
    return this._remainingRounds;
  }

  set remainingRounds(newValue: number) {
    const oldValue = this._remainingRounds;
    // 値が実際に変更された場合のみログを出力
    if (oldValue !== newValue) {
      console.log(
        `%c[DEBUG] remainingRounds changed for "${this.name}" (ID: ${this.identifier})`,
        'color: orange; font-weight: bold;',
        { oldValue, newValue }
      );
      console.trace('Call stack:'); // このセッターを呼び出した箇所のスタックトレースを出力
    }
    this._remainingRounds = newValue;
  }
  // ★★★ END: Debug code for tracking remainingRounds changes ★★★

  @SyncVar() startRound: number = 0;       // 効果が開始されたラウンド
  @SyncVar() color: string = '#888888';    // UI上の色
  @SyncVar() description: string = '';     // ツールチップで表示する説明文
  
      // カードの見た目を動的に変更するためのデータ領域
      // 例: [{ type: 'filter', value: 'grayscale(100%)' }, { type: 'aura', value: '#FFD700' }]
      @SyncVar() visualEffects: { type: string, value: string }[] = [];
  
      // 将来の「機械的な効果」を定義するためのデータ領域
      // 例: { trigger: 'onRoundUpdate', type: 'attributeChange', target: 'HP', value: -1 }
      @SyncVar() effects: Effect[] = [];

  static create(effectData: any): StatusEffect {
    const persistentId = effectData.persistentId || effectData.identifier;
    if (!persistentId) {
      console.warn('persistentId も identifier もないデータは処理できません:', effectData);
      return null;
    }

    let effect = ObjectStore.instance.getObjects(StatusEffect).find(e => e.persistentId === persistentId);

    if (!effect) {
      effect = new StatusEffect(effectData.identifier);
      effect.persistentId = persistentId;
      effect.initialize();
      ObjectStore.instance.add(effect);
    }

    // プロパティ更新
    effect.name = effectData.name ?? '新しい効果';
    effect.emoji = effectData.emoji ?? '✨';
    effect.icon = '';
    effect.color = effectData.color ?? '#888888';
    effect.initialRounds = effectData.initialRounds ?? -1;
    effect.description = effectData.description ?? '';
    effect.visualEffects = effectData.visualEffects ?? [];
    effect.effects = effectData.effects ?? [];

    if ('remainingRounds' in effectData) {
      effect.remainingRounds = effectData.remainingRounds;
    }
    if ('startRound' in effectData) {
      effect.startRound = effectData.startRound;
    }

    return effect;
  }

  constructor(identifier?: string) {
    super(identifier);
    // persistentId が設定されていなければ生成 (新規作成時)
    // ルームデータからのロード時は既に persistentId が復元されているため、生成しない
    if (!this.persistentId) {
      this.persistentId = crypto.randomUUID();
    }
  }

  public initialize(): void {
    super.initialize();
    // initializeでは何もしない
  }

  public onLoad(): void {
    // persistentId の生成はコンストラクタで行うため、onLoadでは何もしない
  }
}
