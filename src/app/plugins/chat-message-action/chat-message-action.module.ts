import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PLUGIN_TOKEN } from '../i-plugin';
import { ChatMessageActionPlugin } from './chat-message-action.plugin';
import { UIExtensionService } from '../service/ui-extension.service';

@NgModule({
  imports: [
    CommonModule
  ],
  providers: [
    {
      provide: PLUGIN_TOKEN,
      useFactory: (uiExtensionService: UIExtensionService) => {
        return new ChatMessageActionPlugin(uiExtensionService);
      },
      deps: [UIExtensionService],
      multi: true
    }
  ]
})
export class ChatMessageActionModule { }
