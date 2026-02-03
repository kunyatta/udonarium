import { Injectable, Injector } from '@angular/core';
import { IPluginWithUI } from '../i-plugin';
import { DynamicStandPluginService } from './dynamic-stand.service';
import { EmoteManagerService } from './emote-manager.service';
import { UIExtensionService } from '../service/ui-extension.service';
import { PluginUiService } from '../service/plugin-ui.service';
import { GameCharacter } from '@udonarium/game-character';
import { DynamicStandSettingComponent } from './dynamic-stand-setting.component';
import { MANIFEST } from './manifest';
import { DataElementExtensionService } from '../service/data-element-extension.service';
import { ImageDataElementComponent } from '../components/image-data-element/image-data-element.component';
import { StandSideDataElementComponent } from './stand-side-data-element/stand-side-data-element.component';

@Injectable()
export class DynamicStandPlugin implements IPluginWithUI {
  readonly manifest = MANIFEST;
  readonly pluginName = MANIFEST.id;

  readonly name = MANIFEST.name;
  readonly type = 'panel'; // 設定画面用
  readonly icon = MANIFEST.icon;

  readonly component = DynamicStandSettingComponent; 
  readonly width: number = 520;
  readonly height: number = 550;

  constructor(
    private service: DynamicStandPluginService,
    private emoteManager: EmoteManagerService,
    private uiExtensionService: UIExtensionService,
    private pluginUiService: PluginUiService,
    private dataElementExtensionService: DataElementExtensionService
  ) {}

  initialize(): void {
    this.service.initialize();
    this.emoteManager.initialize();

    this.dataElementExtensionService.register({
      type: 'imageIdentifier',
      component: ImageDataElementComponent,
      isImage: true,
      label: '画像'
    });

    this.dataElementExtensionService.register({
      type: 'standSide',
      component: StandSideDataElementComponent,
      label: '立ち絵位置'
    });
  }

  initializeUI(injector: Injector): void {
    // 設定メニューへの登録
    this.uiExtensionService.registerAction('settings', {
      name: '立ち絵設定',
      icon: this.icon,
      priority: 200,
      action: () => {
        this.pluginUiService.open(this.component, {
          title: '立ち絵共通設定',
          width: this.width,
          height: this.height
        });
      }
    });

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
      description: 'チャットの「台詞」に反応する立ち絵機能をオンオフします',
      priority: 10
    });
  }
}
