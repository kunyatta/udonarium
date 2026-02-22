import { Injectable } from '@angular/core';
import { IPlugin } from '../i-plugin';
import { CharacterDataExtensionService } from '../service/character-data-extension.service';
import { MANIFEST } from './manifest';

@Injectable({
  providedIn: 'root'
})
export class ChatIconPlugin implements IPlugin {
  readonly manifest = MANIFEST;
  readonly pluginName = MANIFEST.id;

  constructor(private characterDataExtensionService: CharacterDataExtensionService) {}

  initialize() {
    this.characterDataExtensionService.register({
      pluginId: 'chat-icon',
      sectionName: 'チャット設定',
      items: [
        {
          name: 'chatIconIdentifier',
          label: 'アイコン画像',
          type: 'imageIdentifier',
          defaultValue: ''
        }
      ]
    });
  }
}
