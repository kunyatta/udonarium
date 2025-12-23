import { SyncObject, SyncVar } from '@udonarium/core/synchronize-object/decorator';
import { ObjectNode } from '@udonarium/core/synchronize-object/object-node';
import { StatusEffect } from './status-effect';

@SyncObject('StatusEffectDictionary')
export class StatusEffectDictionary extends ObjectNode {
  // システムに登録されている全StatusEffectテンプレートのIDを保持
  @SyncVar() templates: string[] = [];

  public initialize(): void {
    super.initialize();
  }

  /**
   * 指定されたStatusEffectの配列に基づいて、テンプレートリストを同期（上書き）します。
   * @param effects 同期するStatusEffectオブジェクトの配列
   */
  public syncTemplates(effects: StatusEffect[]): void {
    if (!effects) {
      this.templates = [];
      return;
    }
    // null や undefined を除外してから identifier を抽出
    this.templates = effects.filter(e => e).map(e => e.identifier);
  }
}
