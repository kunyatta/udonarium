import { Injectable } from '@angular/core';
import { ChatTabList } from '@udonarium/chat-tab-list';
import { GameCharacter } from '@udonarium/game-character';
import { PeerCursor } from '@udonarium/peer-cursor';
import { NarrativeMessageRule, DEFAULT_NARRATIVE_RULES } from './combat-flow.constants';
import { ChatLoggerService } from '../service/chat-logger.service';
import { CharacterDataService } from '../service/character-data.service';
import { EventSystem } from '@udonarium/core/system'; // 追加

@Injectable({
  providedIn: 'root'
})
export class CombatLogService {
  private targetTabIdentifier: string = '';
  private currentSystemLogSenderName: string = ''; // 追加

  constructor(
    private chatLoggerService: ChatLoggerService,
    private characterDataService: CharacterDataService // CombatStateServiceを削除
  ) {
    // SYSTEM_LOG_SENDER_NAME_CHANGED イベントを購読
    EventSystem.register(this).on('SYSTEM_LOG_SENDER_NAME_CHANGED', event => {
      this.currentSystemLogSenderName = event.data;
    });
  }

  setTargetTabIdentifier(identifier: string): void {
    this.targetTabIdentifier = identifier;
  }

  getTargetTabIdentifier(): string {
    return this.targetTabIdentifier;
  }

  /**
   * ステータス効果付与のログを出力
   */
  logStatusEffectApply(caster: GameCharacter | null, targets: GameCharacter[], effectName: string): void {
    const targetStr = this.formatTargets(targets);
    const casterName = caster ? caster.name : 'システム';
    const message = `${casterName} は ${targetStr} に【${effectName}】を付与した。`;
    this.sendMessage(message, caster);
  }

  /**
   * パラメータ変更のログを出力
   */
  logParameterChange(operator: GameCharacter | null, targets: GameCharacter[], elementName: string, changeValue: number, reason?: string): void {
    const targetStr = this.formatTargets(targets);
    const operatorName = operator ? operator.name : 'システム';
    let messageBody = '';

    // 1. パラメータ名（要素名）に合致するルールを検索
    const rule = DEFAULT_NARRATIVE_RULES.find(r => r.synonyms.includes(elementName));

    if (rule) {
      // 2. ルールが見つかった場合、正負に応じてテンプレートを選択
      let template = '';
      if (changeValue > 0) template = rule.templates.positive;
      else if (changeValue < 0) template = rule.templates.negative;
      else template = rule.templates.zero;

      // 3. プレースホルダーの置換
      messageBody = template
        .replace('{target}', targetStr)
        .replace('{param}', elementName)
        .replace('{value}', Math.abs(changeValue).toString());

    } else {
      // 4. ルールがない場合（デフォルトの挙動）
      const sign = changeValue > 0 ? '+' : '';
      messageBody = `${targetStr} の ${elementName} が ${sign}${changeValue} 変動した。`;
    }

    // 理由（reason）がある場合はメッセージの末尾に付加
    if (reason && reason !== 'そのまま') {
      let reasonText = reason;
      if (reason === '無効') {
        // 無効の場合は「変化しなかった（無効）」のようにする
        // DEFAULT_NARRATIVE_RULES の zero テンプレートが使われているはず
        reasonText = '無効';
      } else if (reason.startsWith('軽減')) {
         // "軽減(防護点)" -> "防護点で軽減"
         const match = reason.match(/軽減\((.+)\)/);
         if (match) {
             reasonText = `${match[1]}で軽減`;
         }
      } else if (reason === 'カスタム') {
          reasonText = '調整済み';
      }
      
      messageBody = `${messageBody}（${reasonText}）`;
    }

    const message = `${operatorName} は ${messageBody}`;
    this.sendMessage(message, operator);
  }

  /**
   * ラウンド進行のログを出力
   */
  logRoundChange(round: number): void {
    const message = `ラウンド ${round} を開始`;
    this.sendMessage(message);
  }

  /**
   * 戦闘開始のログを出力
   */
  logCombatStart(): void {
    this.sendMessage('戦闘開始');
  }

  /**
   * 戦闘終了のログを出力
   */
  logCombatEnd(): void {
    this.sendMessage('戦闘終了');
  }

  /**
   * ステータス効果消滅のログを出力
   */
  logEffectExpiration(target: GameCharacter, effectName: string): void {
    const message = `${target.name} の【${effectName}】の効果が切れた。`;
    this.sendMessage(message); // システムメッセージとして送信
  }

  /**
   * ステータス効果時間変更のログを出力
   */
  logEffectUpdate(target: GameCharacter, effectName: string, remainingRounds: number): void {
    const message = `${target.name} の【${effectName}】の残り時間を ${remainingRounds}ラウンド に変更した。`;
    this.sendMessage(message);
  }

  /**
   * ステータス効果解除のログを出力
   */
  logEffectRemove(target: GameCharacter, effectName: string): void {
    const message = `${target.name} の【${effectName}】を解除した。`;
    this.sendMessage(message);
  }

  private sendMessage(text: string, character?: GameCharacter | null): void {
    const options: any = { // ChatLoggerOptionsをimportしていないのでany
      tabIdentifier: this.targetTabIdentifier
    };

    const systemLogSenderName = this.currentSystemLogSenderName;
    let resolvedSenderCharacter: GameCharacter | null = null;

    if (systemLogSenderName) {
      resolvedSenderCharacter = this.characterDataService.resolveCharacterByName(systemLogSenderName);
    }

    if (resolvedSenderCharacter) {
      this.chatLoggerService.sendCharacterMessage(resolvedSenderCharacter, text, options);
    } else if (character) {
      this.chatLoggerService.sendCharacterMessage(character, text, options);
    } else {
      // 直近の決定事項である「システムではなくPLの発言として残す」意図を反映
      this.chatLoggerService.sendMessage(text, options); 
    }
  }

  /**
   * ターゲット名のリストを整形する (例: "A, B, C" または "A, B 他1体")
   */
  private formatTargets(targets: GameCharacter[]): string {
    if (targets.length === 0) return 'なし';
    const names = targets.map(t => t.name);
    if (names.length <= 3) {
      return names.join(', ');
    }
    return `${names.slice(0, 2).join(', ')} 他${names.length - 2}体`;
  }
}
