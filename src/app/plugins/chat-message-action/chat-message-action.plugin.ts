import { IPlugin } from '../i-plugin';
import { UIExtensionService } from '../service/ui-extension.service';
import { LinkUtil } from '../utils/link-util';
import { MANIFEST } from './manifest';

export class ChatMessageActionPlugin implements IPlugin {
  readonly manifest = MANIFEST;
  readonly pluginName = MANIFEST.id;
  readonly name = MANIFEST.name;
  readonly icon = MANIFEST.icon;

  constructor(
    private uiExtensionService: UIExtensionService
  ) {
    this.registerLinker();
  }

  private registerLinker() {
    this.uiExtensionService.registerFilter('chat-message-display', (text: string) => {
      return LinkUtil.linkify(text);
    });
  }
}