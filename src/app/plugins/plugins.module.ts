import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { PLUGIN_TOKEN } from './i-plugin';
import { pluginModules } from './plugin-registry';
import { PluginInfoPanelComponent } from './plugin-info/plugin-info-panel.component';
import { PluginInfoPlugin } from './plugin-info/plugin-info.plugin';
import { GameObjectInventoryService } from 'service/game-object-inventory.service';
import { CharacterDataService } from './service/character-data.service';
import { ReactiveImageService } from './service/reactive-image.service';
import { SharedModule } from '../shared.module';
import { DependencyResolverService } from './service/dependency-resolver.service';
import { UiDependencyResolverService } from './service/ui-dependency-resolver.service';
import { PluginsComponentsModule } from './components/plugins-components.module';
import { ChatListenerService } from './service/chat-listener.service';
import { PluginMapperService } from './service/plugin-mapper.service';
import { AutolinkPipe } from './pipe/autolink.pipe';

@NgModule({
  declarations: [
    PluginInfoPanelComponent,
    AutolinkPipe,
  ],
  imports: [
    CommonModule,
    FormsModule,
    HttpClientModule,
    SharedModule,
    PluginsComponentsModule,
    ...pluginModules
  ],
  exports: [
    AutolinkPipe
  ],
  providers: [
    // プラグイン情報プラグインを無条件で登録します。
    { provide: PLUGIN_TOKEN, useClass: PluginInfoPlugin, multi: true },
    // プラグインが一つもなくてもInjectionTokenが常に存在するようにダミーのプロバイダーを追加します。
    { provide: PLUGIN_TOKEN, useValue: [], multi: true },
    // 共通サービス
    GameObjectInventoryService,
    CharacterDataService,
    ReactiveImageService,
    DependencyResolverService,
    UiDependencyResolverService,
    ChatListenerService,
    PluginMapperService,
  ]
})
export class PluginsModule { }