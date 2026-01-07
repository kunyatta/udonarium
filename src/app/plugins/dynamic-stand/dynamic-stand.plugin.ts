import { Injectable, Injector } from '@angular/core';
import { IPluginWithUI } from '../i-plugin';
import { DynamicStandPluginService } from './dynamic-stand.service';
import { EmoteManagerService } from './emote-manager.service';
import { UIExtensionService } from '../service/ui-extension.service';
import { GameCharacter } from '@udonarium/game-character';
import { DynamicStandSettingComponent } from './dynamic-stand-setting.component';

@Injectable()
export class DynamicStandPlugin implements IPluginWithUI {
  readonly pluginName = 'dynamic-stand-plugin';
  readonly name = '立ち絵';
  readonly type = 'panel'; // 設定画面用
  readonly icon = 'recent_actors';

  readonly component = DynamicStandSettingComponent; 
  readonly width: number = 400;
  readonly height: number = 550;

  constructor(
    private service: DynamicStandPluginService,
    private emoteManager: EmoteManagerService,
    private uiExtensionService: UIExtensionService
  ) {}

  initialize(): void {
    this.service.initialize();
    this.emoteManager.initialize();
  }

  initializeUI(injector: Injector): void {
    // 1. キャラクターシートへの拡張
    this.uiExtensionService.registerAction('character-sheet', {
      name: '立ち絵設定を追加',
      icon: 'add_photo_alternate',
      action: (context: GameCharacter) => {
        this.service.addStandSetting(context);
      },
      condition: (context) => {
        return context instanceof GameCharacter;
      },
      priority: 100
    });

    // 2. チャットパレットへの拡張 (chat-input 内に表示)
    this.uiExtensionService.registerAction('chat-input', {
      name: '立ち絵',
      icon: (context: any) => {
        const char = context instanceof GameCharacter ? context : (context?.character instanceof GameCharacter ? context.character : null);
        return (char && this.service.isActive(char)) ? 'person' : 'person_off';
      },
      action: (context: any) => {
        // context は { character: GameCharacter, component: ChatInputComponent } または GameCharacter (旧互換)
        const char = context.character instanceof GameCharacter ? context.character : (context instanceof GameCharacter ? context : null);
        
        if (char) {
          this.service.toggleActive(char);
        }
      },
      condition: (context) => {
        return true; 
      },
      priority: 10
    });
  }
}
