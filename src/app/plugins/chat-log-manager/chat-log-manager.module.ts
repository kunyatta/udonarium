import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PLUGIN_TOKEN } from '../i-plugin';
import { ChatLogManagerPlugin } from './chat-log-manager.plugin';
import { ChatLogManagerPanelComponent } from './chat-log-manager-panel.component';

@NgModule({
  declarations: [
    ChatLogManagerPanelComponent
  ],
  imports: [
    CommonModule,
    FormsModule
  ],
  providers: [
    { provide: PLUGIN_TOKEN, useClass: ChatLogManagerPlugin, multi: true }
  ],
  // エントリーコンポーネントとして登録が必要（Angular 9以降はIvyで不要な場合もあるが念のため）
  // exports: [ChatLogManagerPanelComponent] // 必要に応じて
})
export class ChatLogManagerModule { }
