import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { ChatMessage } from '@udonarium/chat-message';
import { PanelService } from 'service/panel.service';

@Component({
  selector: 'chat-message-edit-panel',
  templateUrl: './chat-message-edit-modal.component.html',
  styleUrls: ['./chat-message-edit-modal.component.css']
})
export class ChatMessageEditModalComponent implements OnInit {
  chatMessage: ChatMessage;
  text: string = '';

  @ViewChild('textArea', { static: true }) textArea: ElementRef;

  constructor(
    private panelService: PanelService,
    private elementRef: ElementRef
  ) {}

  ngOnInit() {
    if (this.chatMessage) {
      this.text = this.chatMessage.text;
    }
    
    // タイトル設定
    this.panelService.title = 'メッセージ編集';

    // フォーカス
    setTimeout(() => {
      if (this.textArea) this.textArea.nativeElement.focus();
    }, 10);
  }

  onFocusOut(event: FocusEvent) {
    // フォーカス移動先が自分の内部要素なら何もしない
    if (this.elementRef.nativeElement.contains(event.relatedTarget)) {
      return;
    }
    // 外部へフォーカスが移動したら閉じる
    this.cancel();
  }

  get isChanged(): boolean {
    return this.chatMessage && this.text !== this.chatMessage.text && this.text.trim().length > 0;
  }

  save() {
    if (!this.isChanged) return;
    
    this.chatMessage.value = this.text;
    
    if (!this.chatMessage.tag.includes('edited')) {
      this.chatMessage.tag = (this.chatMessage.tag + ' edited').trim();
    }
    
    this.panelService.close();
  }

  cancel() {
    this.panelService.close();
  }
}
