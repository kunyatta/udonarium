import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PLUGIN_TOKEN } from '../i-plugin';
import { ChatIconPlugin } from './chat-icon.plugin';

@NgModule({
  imports: [
    CommonModule
  ],
  providers: [
    { provide: PLUGIN_TOKEN, useClass: ChatIconPlugin, multi: true }
  ]
})
export class ChatIconModule { }
