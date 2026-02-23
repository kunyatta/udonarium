import { Injectable, Injector } from '@angular/core';
import { IPluginWithUI } from '../i-plugin';
import { CharacterDataExtensionService } from '../service/character-data-extension.service';
import { UIExtensionService } from '../service/ui-extension.service';
import { GameCharacter } from '@udonarium/game-character';
import { MANIFEST } from './manifest';

@Injectable({
  providedIn: 'root'
})
export class ChatIconPlugin implements IPluginWithUI {
  readonly manifest = MANIFEST;
  readonly pluginName = MANIFEST.id;
  readonly type = 'toggle'; // パネルを持たない場合は toggle を指定
  readonly icon = 'insert_photo';

  constructor(
    private characterDataExtensionService: CharacterDataExtensionService,
    private uiExtensionService: UIExtensionService
  ) {}

  initialize() {
    this.characterDataExtensionService.register({
      pluginId: 'chat-icon',
      sectionName: 'チャット設定',
      items: [
        {
          name: 'アイコン画像',
          label: 'アイコン画像',
          type: 'imageIdentifier',
          defaultValue: (character: GameCharacter) => {
            return character.imageFile ? character.imageFile.identifier : '';
          }
        }
      ]
    });
  }

  initializeUI(injector: Injector) {
    // 共通ボタンに統合されたため、個別の登録は不要
  }
}
