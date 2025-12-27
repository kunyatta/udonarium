import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { PLUGIN_TOKEN } from './i-plugin';
import { environment } from '../../environments/environment';
import { PluginLauncherPanelComponent } from './plugin-launcher/plugin-launcher-panel.component';
import { PluginLauncherPlugin } from './plugin-launcher/plugin-launcher.plugin';
import { GameObjectInventoryService } from 'service/game-object-inventory.service';
import { DataManagerPlugin } from './data-manager.plugin';
import { CharacterDataService } from './service/character-data.service';
import { ReactiveImageService } from './service/reactive-image.service';
import { SharedModule } from '../shared.module';
import { DependencyResolverService } from './service/dependency-resolver.service';
import { UiDependencyResolverService } from './service/ui-dependency-resolver.service';
import { PluginsComponentsModule } from './components/plugins-components.module';
import { ChatListenerService } from './service/chat-listener.service';

@NgModule({
  declarations: [
    PluginLauncherPanelComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    HttpClientModule,
    SharedModule,
    PluginsComponentsModule,
    ...environment.pluginModules
  ],
  providers: [
    // プラグインランチャープラグインを無条件で登録します。
    { provide: PLUGIN_TOKEN, useClass: PluginLauncherPlugin, multi: true },
    // データマネージャプラグインを無条件で登録します。
    { provide: PLUGIN_TOKEN, useClass: DataManagerPlugin, multi: true },
    // プラグインが一つもなくてもInjectionTokenが常に存在するようにダミーのプロバイダーを追加します。
    { provide: PLUGIN_TOKEN, useValue: [], multi: true },
    // 共通サービス
    GameObjectInventoryService,
    CharacterDataService,
    ReactiveImageService,
    DependencyResolverService,
    UiDependencyResolverService,
    ChatListenerService,
  ]
})
export class PluginsModule { }