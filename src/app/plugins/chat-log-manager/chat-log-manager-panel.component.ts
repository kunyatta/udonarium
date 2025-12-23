import { Component, OnInit, OnDestroy, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { ChatTab } from '@udonarium/chat-tab';
import { ChatTabList } from '@udonarium/chat-tab-list';
import { ChatMessageService } from 'service/chat-message.service';
import { PeerCursor } from '@udonarium/peer-cursor';
import { PanelService } from 'service/panel.service';
import { EventSystem } from '@udonarium/core/system';
import { ChatLoggerService } from '../service/chat-logger.service'; // ChatLoggerServiceをインポート

@Component({
  selector: 'app-chat-log-manager-panel',
  templateUrl: './chat-log-manager-panel.component.html',
  styleUrls: ['./chat-log-manager-panel.component.css']
})
export class ChatLogManagerPanelComponent implements OnInit, OnDestroy, AfterViewInit {
  
  selectedTabIdentifier: string = '';
  allowDeleteLog: boolean = false;
  chatTabs: ChatTab[] = []; // ゲッターからプロパティに変更

  get selectedTab(): ChatTab | undefined {
    return this.chatTabs.find(tab => tab.identifier === this.selectedTabIdentifier);
  }

  constructor(
    private chatMessageService: ChatMessageService,
    private panelService: PanelService,
    private changeDetectorRef: ChangeDetectorRef,
    private chatLoggerService: ChatLoggerService // ChatLoggerServiceを注入
  ) { }

  ngOnInit(): void {
    EventSystem.register(this)
      .on('UPDATE_GAME_OBJECT', event => {
        if (event.data.identifier === ChatTabList.instance.identifier) {
          this.updateChatTabs(); // 更新
          this.ensureTabSelection();
        }
      });
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.updateChatTabs(); // 初期化
      this.ensureTabSelection();
    });
  }

  private updateChatTabs(): void {
    this.chatTabs = ChatTabList.instance.chatTabs;
  }

  ngOnDestroy(): void {
    EventSystem.unregister(this);
  }

  // タブ選択の有効性を確認し、無効なら再設定する
  private ensureTabSelection(): void {
    if (this.chatTabs.length === 0) {
      this.selectedTabIdentifier = '';
      return;
    }

    // selectedTabIdentifierの確認
    if (!this.chatTabs.some(tab => tab.identifier === this.selectedTabIdentifier)) {
      this.selectedTabIdentifier = this.chatTabs[0].identifier;
    }
  }

  deleteLog(): void {
    if (!this.allowDeleteLog || !this.selectedTab) return;
    this.clearTabLog(this.selectedTab);
  }

  deleteAllLogs(): void {
    if (!this.allowDeleteLog) return;
    for (const tab of this.chatTabs) {
      this.clearTabLog(tab);
    }
  }

  private clearTabLog(tab: ChatTab): void {
    while (tab.children.length > 0) {
      tab.children[0].destroy();
    }
    
    // 削除完了メッセージを送信（削除したタブそのものへ）
    const message = `「${tab.name}」のログをクリアしました`;
    
    this.chatLoggerService.sendSystemMessage(message, {
      tabIdentifier: tab.identifier // 削除したタブそのものへ送信
    });
  }
}
