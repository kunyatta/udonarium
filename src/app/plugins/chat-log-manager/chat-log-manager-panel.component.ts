import { Component, OnInit, OnDestroy, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { ChatTab } from '@udonarium/chat-tab';
import { ChatTabList } from '@udonarium/chat-tab-list';
import { ChatMessageService } from 'service/chat-message.service';
import { PanelService } from 'service/panel.service';
import { EventSystem } from '@udonarium/core/system';
import { ChatLoggerService } from '../service/chat-logger.service';
import { ChatMessage } from '@udonarium/chat-message';

@Component({
  selector: 'app-chat-log-manager-panel',
  templateUrl: './chat-log-manager-panel.component.html',
  styleUrls: ['./chat-log-manager-panel.component.css']
})
export class ChatLogManagerPanelComponent implements OnInit, OnDestroy, AfterViewInit {
  
  selectedTabIdentifier: string = '';
  allowDeleteLog: boolean = false;
  chatTabs: ChatTab[] = [];
  
  // 新規追加プロパティ
  selectedMainTab: 'export' | 'manage' = 'export';
  exportTarget: 'selected' | 'all' = 'selected';

  get selectedTab(): ChatTab | undefined {
    return this.chatTabs.find(tab => tab.identifier === this.selectedTabIdentifier);
  }

  constructor(
    private chatMessageService: ChatMessageService,
    private panelService: PanelService,
    private changeDetectorRef: ChangeDetectorRef,
    private chatLoggerService: ChatLoggerService
  ) { }

  ngOnInit(): void {
    EventSystem.register(this)
      .on('UPDATE_GAME_OBJECT', event => {
        if (event.data.identifier === ChatTabList.instance.identifier) {
          this.updateChatTabs();
          this.ensureTabSelection();
        }
      });
  }

  ngOnDestroy(): void {
    EventSystem.unregister(this);
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.updateChatTabs();
      this.ensureTabSelection();
    });
  }

  private updateChatTabs(): void {
    this.chatTabs = ChatTabList.instance.chatTabs;
    this.changeDetectorRef.markForCheck();
  }

  private ensureTabSelection(): void {
    if (this.chatTabs.length > 0 && !this.selectedTab) {
      this.selectedTabIdentifier = this.chatTabs[0].identifier;
    }
    this.changeDetectorRef.markForCheck();
  }

  // タブ切り替え
  selectMainTab(tab: 'export' | 'manage'): void {
    this.selectedMainTab = tab;
  }

  // ログ保存処理
  saveLog(): void {
    const tabsToExport = this.exportTarget === 'all' 
      ? this.chatTabs 
      : (this.selectedTab ? [this.selectedTab] : []);

    if (tabsToExport.length === 0) return;

    let logText = '';
    const timestamp = this.getTimestampString();
    const targetName = this.exportTarget === 'all' ? 'all' : (this.selectedTab?.name || 'chat');
    
    tabsToExport.forEach((tab, index) => {
      if (this.exportTarget === 'all') {
        logText += `=== ${tab.name} ===\n`;
      }
      
      const messages = tab.chatMessages.filter(msg => msg.isDisplayable);
      messages.forEach(msg => {
        logText += this.formatMessage(msg) + '\n';
      });

      if (this.exportTarget === 'all' && index < tabsToExport.length - 1) {
        logText += '--------------------\n\n';
      }
    });

    const fileName = `chatlog_${targetName}_${timestamp}.txt`;
    this.downloadFile(logText, fileName);

    // 通知
    this.chatLoggerService.sendSystemMessage(`チャットログを保存しました: ${fileName}`);
  }

  private formatMessage(msg: ChatMessage): string {
    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const name = msg.name || (msg.isSystem ? 'system' : 'unknown');
    return `[${time}] ${name} : ${msg.text}`;
  }

  private getTimestampString(): string {
    const now = new Date();
    const Y = now.getFullYear();
    const M = ('0' + (now.getMonth() + 1)).slice(-2);
    const D = ('0' + now.getDate()).slice(-2);
    const h = ('0' + now.getHours()).slice(-2);
    const m = ('0' + now.getMinutes()).slice(-2);
    return `${Y}${M}${D}_${h}${m}`;
  }

  private downloadFile(content: string, fileName: string): void {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  // 既存の消去処理
  deleteLog(): void {
    const tab = this.selectedTab;
    if (!tab || !this.allowDeleteLog) return;

    if (!confirm(`「${tab.name}」のログを完全に消去します。よろしいですか？`)) return;

    const messages = [...tab.chatMessages];
    for (const msg of messages) {
      msg.destroy();
    }
    
    this.chatLoggerService.sendSystemMessage(`「${tab.name}」のログをクリアしました`, {
      tabIdentifier: tab.identifier
    });
  }

  deleteAllLogs(): void {
    if (!this.allowDeleteLog) return;

    if (!confirm('全てのタブのチャットログを完全に消去します。よろしいですか？')) return;

    for (const tab of this.chatTabs) {
      const messages = [...tab.chatMessages];
      for (const msg of messages) {
        msg.destroy();
      }
    }
    
    this.chatLoggerService.sendSystemMessage('全てのログをクリアしました');
  }
}
