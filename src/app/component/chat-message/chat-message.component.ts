import { animate, keyframes, style, transition, trigger } from '@angular/animations';
import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';

import { ChatMessage } from '@udonarium/chat-message';
import { ImageFile } from '@udonarium/core/file-storage/image-file';
import { ChatMessageService } from 'service/chat-message.service';

import { UIExtensionService } from '../../plugins/service/ui-extension.service'; // ----- MODIFICATION (Gemini) for ChatMessageAction -----

@Component({
  selector: 'chat-message',
  templateUrl: './chat-message.component.html',
  styleUrls: ['./chat-message.component.css'],
  animations: [
    trigger('flyInOut', [
      transition('* => active', [
        animate('200ms ease-out', keyframes([
          style({ transform: 'translateX(100px)', opacity: '0', offset: 0 }),
          style({ transform: 'translateX(0)', opacity: '1', offset: 1.0 })
        ]))
      ]),
      transition('void => *', [
        animate('200ms ease-out', keyframes([
          style({ opacity: '0', offset: 0 }),
          style({ opacity: '1', offset: 1.0 })
        ]))
      ])
    ])
  ],
  changeDetection: ChangeDetectionStrategy.Default
})

export class ChatMessageComponent implements OnInit {
  @Input() chatMessage: ChatMessage;
  imageFile: ImageFile = ImageFile.Empty;
  animeState: string = 'inactive';

  constructor(
    private chatMessageService: ChatMessageService,
    private uiExtensionService: UIExtensionService, // ----- MODIFICATION (Gemini) for ChatMessageAction -----
  ) { }

  ngOnInit() {
    let file: ImageFile = this.chatMessage.image;
    if (file) this.imageFile = file;
    let time = this.chatMessageService.getTime();
    if (time - 10 * 1000 < this.chatMessage.timestamp) this.animeState = 'active';
  }

  discloseMessage() {
    this.chatMessage.tag = this.chatMessage.tag.replace('secret', '');
  }

  // ----- MODIFICATION START (Gemini) for ChatMessageAction -----
  get processedText(): string {
    const escaped = this.uiExtensionService.escapeHtml(this.chatMessage.text);
    return this.uiExtensionService.applyFilters('chat-message-display', escaped, this.chatMessage);
  }

  onLinkClick($event: MouseEvent) {
    if ($event && $event.target instanceof HTMLAnchorElement) {
      const href = $event.target.getAttribute('href');
      if (href) {
        $event.preventDefault();
        if (window.confirm('外部サイトへ移動しますか？\n\n' + href)) {
          window.open(href, '_blank', 'noopener noreferrer');
        }
      }
    }
  }
  // ----- MODIFICATION END (Gemini) for ChatMessageAction -----
}
