import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatNotificationService } from './chat-notification.service';
import { ChatNotificationPlugin } from './chat-notification.plugin';
import { PLUGIN_TOKEN } from '../i-plugin';

@NgModule({
  declarations: [],
  imports: [
    CommonModule
  ],
  providers: [
    ChatNotificationService,
    ChatNotificationPlugin,
    { provide: PLUGIN_TOKEN, useClass: ChatNotificationPlugin, multi: true }
  ]
})
export class ChatNotificationModule { }
