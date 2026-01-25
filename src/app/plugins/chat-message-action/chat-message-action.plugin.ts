import { IPlugin } from '../i-plugin';
import { UIExtensionService } from '../service/ui-extension.service';
import { PluginUiService } from '../service/plugin-ui.service';
import { LinkUtil } from '../utils/link-util';
import { MANIFEST } from './manifest';
import { ChatMessage } from '@udonarium/chat-message';
import { Network } from '@udonarium/core/system';
import { ChatMessageEditModalComponent } from './chat-message-edit-modal.component';

export class ChatMessageActionPlugin implements IPlugin {
  readonly manifest = MANIFEST;
  readonly pluginName = MANIFEST.id;
  readonly name = MANIFEST.name;
  readonly icon = MANIFEST.icon;

  constructor(
    private uiExtensionService: UIExtensionService,
    private pluginUiService: PluginUiService
  ) {
    this.registerLinker();
    this.registerEditor();
  }

  private registerLinker() {
    this.uiExtensionService.registerFilter('chat-message-display', (text: string, message: ChatMessage) => {
      let processed = LinkUtil.linkify(text);
      
      // 編集済み表示の追加
      if (message && message.tag && message.tag.includes('edited')) {
        processed += '<span class="is-edited" style="font-size: 0.7em; color: #888; margin-left: 4px; vertical-align: bottom;">(編集済)</span>';
      }
      
      return processed;
    });
  }

  private registerEditor() {
    this.uiExtensionService.registerAction('chat-message-menu', {
      name: 'メッセージを編集',
      icon: 'edit',
      priority: 10,
      condition: (message: ChatMessage) => {
        return message && message.from === Network.peer.userId && !message.isSystem;
      },
      action: (message: ChatMessage, pointer?: { x: number, y: number }) => {
        const panel = this.pluginUiService.openAtCursor(ChatMessageEditModalComponent, {
          isSingleton: true,
          // position: 'center', 座標指定を有効にするために削除
          align: 'top-left',
          offsetX: 10,
          offsetY: 10,
          width: 300,
          height: 152
        }, pointer); // pointer (座標) があればそれが優先される

        // コンポーネントにデータを渡す
        panel.chatMessage = message;
      }
    });
  }
}
      