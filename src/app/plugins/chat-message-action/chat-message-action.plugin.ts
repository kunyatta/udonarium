import { UIExtensionService } from '../service/ui-extension.service';
import Autolinker from 'autolinker';

export class ChatMessageActionPlugin {
  constructor(
    private uiExtensionService: UIExtensionService
  ) {
    this.registerLinker();
  }

  private registerLinker() {
    this.uiExtensionService.registerFilter('chat-message-display', (text: string) => {
      return Autolinker.link(text, {
        urls: { schemeMatches: true, tldMatches: true, ipV4Matches: false },
        email: false,
        phone: false,
        mention: false,
        hashtag: false,
        stripPrefix: false,
        stripTrailingSlash: false,
        newWindow: true,
        truncate: { length: 48, location: 'end' },
        className: 'outer-link',
      });
    });
  }
}
