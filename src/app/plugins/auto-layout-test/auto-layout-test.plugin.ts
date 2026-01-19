import { Injectable, Injector, OnDestroy } from '@angular/core';
import { IPluginWithUI } from '../i-plugin';
import { PluginUiService } from '../service/plugin-ui.service';
import { AutoLayoutTestComponent } from './auto-layout-test.component';
import { EventSystem } from '@udonarium/core/system';

@Injectable({
  providedIn: 'root'
})
export class AutoLayoutTestPlugin implements IPluginWithUI, OnDestroy {
  readonly pluginName: string = 'AutoLayoutTestPlugin';
  readonly name: string = '自動レイアウトテスト';
  readonly type: 'panel' = 'panel';
  readonly icon: string = 'photo_size_select_large';
  readonly component = AutoLayoutTestComponent;
  width: number = 400; // 初期幅（AutoLayoutで自動調整される）
  height: number = 400; // 初期高さ（AutoLayoutで自動調整される）
  layout: 'full-auto' = 'full-auto'; // 自動レイアウトを有効にする
  readonly version = '0.1.0';
  readonly description = '自動レイアウト機能（AutoLayoutPanel）の動作確認用プラグインです。';
  readonly isExperimental = true;

  constructor(
    private pluginUiService: PluginUiService,
    private injector: Injector
  ) { }

  initialize(): void {
    // initialize時に自動でパネルを開く、またはプラグインリストに登録される
  }

  initializeUI(injector: Injector): void {
    // 自身がUIとして起動される際の処理 (今回はPluginLauncherから直接開かれる想定)
  }

  // プラグインランチャーから開かれることを想定したメソッド
  openPanel(): void {
    this.pluginUiService.open(AutoLayoutTestComponent, {
      title: '自動レイアウトテスト',
      width: this.width,
      height: this.height,
      isSingleton: true,
      layout: 'full-auto' // ★ここが重要：AutoLayoutを有効にする
    });
  }

  ngOnDestroy(): void {
    EventSystem.unregister(this);
  }
}
