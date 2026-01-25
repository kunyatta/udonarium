import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PLUGIN_TOKEN } from '../i-plugin';
import { ChatMessageActionPlugin } from './chat-message-action.plugin';
import { UIExtensionService } from '../service/ui-extension.service';
import { PluginUiService } from '../service/plugin-ui.service';
import { ChatMessageEditModalComponent } from './chat-message-edit-modal.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule
  ],
  declarations: [
    ChatMessageEditModalComponent
  ],
  providers: [
    {
      provide: PLUGIN_TOKEN,
      useFactory: (uiExtensionService: UIExtensionService, pluginUiService: PluginUiService) => {
        return new ChatMessageActionPlugin(uiExtensionService, pluginUiService);
      },
      deps: [UIExtensionService, PluginUiService],
      multi: true
    }
  ]
})
export class ChatMessageActionModule { }
