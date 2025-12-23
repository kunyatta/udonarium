import { Injectable } from '@angular/core';
import { ChatMessageService } from '../../service/chat-message.service';
import { ChatTabList } from '@udonarium/chat-tab-list';
import { ChatTab } from '@udonarium/chat-tab';
import { GameCharacter } from '@udonarium/game-character';
import { PeerCursor } from '@udonarium/peer-cursor';

export interface ChatLoggerOptions {
  // 送信先タブ関連
  tabIdentifier?: string; // 指定がなければ自動解決

  // 送信者情報 (自動解決されるが上書き可能)
  sendFrom?: string;      // ID
  name?: string;          // 表示名
  color?: string;         // 文字色
  imageIdentifier?: string; // アイコン画像ID
  isUseFaceIcon?: boolean;  // 顔アイコン使用フラグ

  // その他
  gameType?: string;      // ダイスボット種別
  sendTo?: string;        // 秘話相手（通常はundefined）
}

@Injectable({
  providedIn: 'root'
})
export class ChatLoggerService {
  private defaultTabIdentifier: string = '';

  constructor(
    private chatMessageService: ChatMessageService
  ) { }

  /**
   * デフォルトの出力先タブIDを設定する
   * @param identifier 設定するタブの識別子
   */
  setDefaultTabIdentifier(identifier: string): void {
    this.defaultTabIdentifier = identifier;
  }

  /**
   * キャラクターとしてメッセージを送信する
   * 名前、色、アイコンはキャラクター情報から自動解決される。
   * @param character 送信元キャラクター (必須)
   * @param text メッセージ本文
   * @param options オプション (上書き用)
   */
  sendCharacterMessage(
    character: GameCharacter,
    text: string,
    options: Partial<ChatLoggerOptions> = {}
  ): void {
    const resolvedOptions = this.resolveCharacterOptions(character, options);
    this.executeSend(text, resolvedOptions);
  }

  /**
   * システムメッセージとして送信する
   * デフォルトのシステム名、色（グレー等）が適用される。
   * @param text メッセージ本文
   * @param options オプション (上書き用)
   */
  sendSystemMessage(
    text: string,
    options: Partial<ChatLoggerOptions> = {}
  ): void {
    const resolvedOptions = this.resolveSystemOptions(options);
    this.executeSend(text, resolvedOptions);
  }

  /**
   * 任意の送信元としてメッセージを送信する (汎用/上級者向け)
   * @param text メッセージ本文
   * @param options 必須パラメータを含むオプション
   */
  sendMessage(
    text: string,
    options: ChatLoggerOptions
  ): void {
    this.executeSend(text, options);
  }

  private executeSend(text: string, options: ChatLoggerOptions): void {
    const targetTab = this.resolveTargetTab(options.tabIdentifier);

    if (!targetTab) {
      console.warn('ChatLoggerService: Target tab not found. Fallback to operation log.', text);
      this.chatMessageService.sendOperationLog(text);
      return;
    }

    // デフォルト値の補完とoptionsによる上書き
    const sendFrom = options.sendFrom !== undefined ? options.sendFrom : PeerCursor.myCursor.identifier;
    // nameはChatMessageServiceの引数には直接存在しないため、sendFromに対応するオブジェクトの名前が使われることを想定
    const color = options.color !== undefined ? options.color : PeerCursor.myCursor.color || '#000000';
    const gameType = options.gameType !== undefined ? options.gameType : '';
    const isUseFaceIcon = options.isUseFaceIcon !== undefined ? options.isUseFaceIcon : true;
    const imageIdentifier = options.imageIdentifier !== undefined ? options.imageIdentifier : undefined; 
    const sendTo = options.sendTo !== undefined ? options.sendTo : undefined;
    
    this.chatMessageService.sendMessage(
      targetTab,      // chatTab
      text,           // text
      gameType,       // gameType
      sendFrom,       // sendFrom
      sendTo          // sendTo
    );
  }

  private resolveCharacterOptions(character: GameCharacter, options: Partial<ChatLoggerOptions>): ChatLoggerOptions {
    const palette = character.chatPalette;
    
    const resolved: ChatLoggerOptions = {
      sendFrom: character.identifier,
      name: character.name, // nameはoptionsで上書きされる可能性はあるが、ChatMessageServiceには直接渡されない
      color: (palette && palette.color) ? palette.color : PeerCursor.myCursor.color,
      gameType: (palette && palette.dicebot) ? palette.dicebot : '',
      imageIdentifier: character.identifier, 
      isUseFaceIcon: true,
      ...options
    };

    return resolved;
  }

  private resolveSystemOptions(options: Partial<ChatLoggerOptions>): ChatLoggerOptions {
    const resolved: ChatLoggerOptions = {
      sendFrom: 'System', // システムメッセージの送信元は固定
      name: 'システム', // nameはoptionsで上書きされる可能性はあるが、ChatMessageServiceには直接渡されない
      color: '#808080', // デフォルトのシステムメッセージの色
      gameType: '',
      isUseFaceIcon: false,
      imageIdentifier: undefined, 
      ...options
    };

    return resolved;
  }

  private resolveTargetTab(identifier?: string): ChatTab | null {
    if (identifier) {
      const tab = ChatTabList.instance.chatTabs.find(t => t.identifier === identifier);
      if (tab) return tab;
    }

    if (this.defaultTabIdentifier) {
      const tab = ChatTabList.instance.chatTabs.find(t => t.identifier === this.defaultTabIdentifier);
      if (tab) return tab;
    }

    if (ChatTabList.instance.chatTabs.length > 0) {
      return ChatTabList.instance.chatTabs[0];
    }
    
    return null;
  }
}
