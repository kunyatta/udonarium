import { Injectable } from '@angular/core';
import { GameCharacter } from '@udonarium/game-character';
import { PeerCursor } from '@udonarium/peer-cursor';
import { StatusEffect } from './models/status-effect';

@Injectable({
  providedIn: 'root'
})
export class CombatLogService {

  constructor() { }

  /**
   * ステータス効果の付与に関するログメッセージを生成する
   * @param caster 術者
   * @param targets 対象キャラクター配列
   * @param effect ステータス効果
   * @returns 生成されたメッセージ
   */
  buildStatusEffectMessage(caster: GameCharacter, targets: GameCharacter[], effect: StatusEffect): string {
    const targetName = this.buildTargetName(targets);
    return `${caster.name} は ${targetName} に【${effect.name}】を付与した。`;
  }

  /**
   * パラメータ変更に関するログメッセージを生成する
   * @param operator 操作者
   * @param targets 対象キャラクター配列
   * @param paramDisplayName パラメータの表示名 (例: 'HP (現在値)')
   * @param changeValue 変更値 (例: -10)
   * @returns 生成されたメッセージ
   */
  buildParameterChangeMessage(operator: GameCharacter | PeerCursor, targets: GameCharacter[], paramDisplayName: string, changeValue: number): string {
    const operatorName = operator.name;
    const targetName = this.buildTargetName(targets);
    const sign = changeValue > 0 ? '+' : '';
    return `${operatorName} は ${targetName} の ${paramDisplayName} を ${sign}${changeValue} した。`;
  }

  /**
   * ステータス効果の消滅に関するログメッセージを生成する
   * @param target 対象キャラクター
   * @param effectName 効果名
   * @returns 生成されたメッセージ
   */
  buildEffectEndMessage(target: GameCharacter, effectName: string): string {
    return `${target.name} の【${effectName}】の効果が切れた。`;
  }

  /**
   * 複数ターゲットの表示名を生成する
   * @param targets 対象キャラクター配列
   * @returns 生成された表示名 (例: 'ゴブリン', '2体')
   */
  private buildTargetName(targets: GameCharacter[]): string {
    if (targets.length === 0) {
      return '[対象なし]';
    }
    if (targets.length === 1) {
      return targets[0].name;
    }
    return `${targets.length}体`;
  }
}
