import { Injectable, OnDestroy } from '@angular/core';
import { EventSystem } from '@udonarium/core/system';
import { ChatMessage } from '@udonarium/chat-message';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';

export interface ChatListenerRule {
  owner: object;           // 登録者
  name: string;            // ルール名 (デバッグ/識別用)
  keyword?: string;        // 一致キーワード
  keywordRegExp?: RegExp;  // 正規表現
  characterName?: string;  // 発言者名
  from?: string;           // 送信元 (例: 'System-BCDice')
  isLocalOnly?: boolean;   // trueの場合、自分の発言にのみ反応する（デフォルト: false）
  callback: (message: ChatMessage, match: RegExpMatchArray | null) => void;
}

@Injectable({
  providedIn: 'root'
})
export class ChatListenerService implements OnDestroy {
  private rules: ChatListenerRule[] = [];

  constructor() {
    EventSystem.register(this).on('MESSAGE_ADDED', event => {
      const messageIdentifier = event.data.messageIdentifier;
      const message = ObjectStore.instance.get<ChatMessage>(messageIdentifier);
      if (message) {
        this.onMessageReceived(message);
      }
    });
  }

  ngOnDestroy() {
    EventSystem.unregister(this);
    this.rules = [];
  }

  /**
   * 監視ルールを追加する
   */
  addRule(rule: ChatListenerRule) {
    this.rules.push(rule);
  }

  /**
   * 指定した登録者に紐づくルールをすべて削除する
   */
  removeRulesByOwner(owner: object) {
    this.rules = this.rules.filter(r => r.owner !== owner);
  }

  /**
   * ルール名でルールを削除する
   */
  removeRuleByName(name: string) {
    this.rules = this.rules.filter(r => r.name !== name);
  }

  private onMessageReceived(message: ChatMessage) {
    const text = message.value?.toString() || '';
    
    for (const rule of this.rules) {
      if (rule.isLocalOnly && !message.isSendFromSelf) continue;
      if (!this.checkCondition(message, text, rule)) continue;

      let match: RegExpMatchArray | null = null;
      if (rule.keywordRegExp) {
        match = text.match(rule.keywordRegExp);
      }

      try {
        rule.callback(message, match);
      } catch (e) {
        console.error(`[ChatListener] Error in callback for rule "${rule.name}":`, e);
      }
    }
  }

  private checkCondition(message: ChatMessage, text: string, rule: ChatListenerRule): boolean {
    // 送信元のチェック
    if (rule.from && message.from !== rule.from) return false;

    // 発言者名のチェック
    if (rule.characterName && message.name !== rule.characterName) return false;

    // キーワードのチェック
    if (rule.keyword && !text.includes(rule.keyword)) return false;

    // 正規表現のチェック
    if (rule.keywordRegExp && !rule.keywordRegExp.test(text)) return false;

    return true;
  }
}