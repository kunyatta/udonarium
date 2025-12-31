import { Injectable, Injector } from '@angular/core';
import { IPluginWithUI } from '../i-plugin';
import { PluginOverlayService } from '../service/plugin-overlay.service';
import { OverlayControllerComponent } from './overlay-test/overlay-controller.component';
import { OverlayObject } from '../overlay-object';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { OverlayEffectsService } from '../service/overlay-effects.service';

@Injectable({
  providedIn: 'root'
})
export class OverlayTestPlugin implements IPluginWithUI {
  readonly pluginName = 'OverlayTestPlugin';

  name: string = 'オーバーレイ検証(P2P)';
  type: 'panel' = 'panel';
  icon: string = 'layers';
  component = OverlayControllerComponent;
  width: number = 250;
  height: number = 400; // 少し高く調整

  constructor(
    private pluginOverlayService: PluginOverlayService,
    private effectsService: OverlayEffectsService
  ) {}

  initialize(): void {
    // 依存関係を削除。独自のレンダラーが必要な場合は、
    // このプラグイン内に専用のコンポーネントを作成して登録してください。
  }

  initializeUI(injector: Injector): void {}

  /**
   * 基盤を使って新しい演出を作成します。
   */
  createTestOverlay(type: string, label: string) {
    // 指定されたタイプ（デフォルトは 'speech'）で生成
    const obj = this.pluginOverlayService.createOverlay(type || 'speech');
    obj.label = label;
    obj.isDebug = true; // テスト用なのでデバッグ情報を表示
    
    // コンテンツ（画像）のダミーセット
    obj.updateContent('url', './assets/images/ic_account_circle_black_24dp_2x.png');
    
    return obj;
  }

  /**
   * 全てのデータを消去します
   */
  clearAll() {
    const existing = ObjectStore.instance.getObjects<OverlayObject>(OverlayObject);
    for (const obj of existing) {
      obj.destroy();
    }
  }
}
