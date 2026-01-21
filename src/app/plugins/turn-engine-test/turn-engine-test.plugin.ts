import { Injectable, Injector, OnDestroy } from '@angular/core';
import { IPluginWithUI } from '../i-plugin';
import { PluginUiService } from '../service/plugin-ui.service';
import { TurnEngineTestComponent } from './turn-engine-test.component';
import { EventSystem } from '@udonarium/core/system';
import { MANIFEST } from './manifest';

@Injectable({
  providedIn: 'root'
})
export class TurnEngineTestPlugin implements IPluginWithUI, OnDestroy {
  readonly manifest = MANIFEST;
  readonly pluginName = MANIFEST.id;
  readonly name = MANIFEST.name;
  readonly type = 'panel';
  readonly icon = MANIFEST.icon;
  readonly component = TurnEngineTestComponent;
  width: number = 400;
  height: number = 400;
  layout: 'full-auto' = 'full-auto';

  constructor(
    private pluginUiService: PluginUiService,
    private injector: Injector
  ) { }

  initialize(): void {
  }

  initializeUI(injector: Injector): void {
  }

  openPanel(): void {
    this.pluginUiService.open(TurnEngineTestComponent, {
      title: 'ターンエンジンテスト',
      width: this.width,
      height: this.height,
      isSingleton: true,
      layout: 'full-auto'
    });
  }

  ngOnDestroy(): void {
    EventSystem.unregister(this);
  }
}
