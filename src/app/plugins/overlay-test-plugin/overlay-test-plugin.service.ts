import { Injectable, Injector } from '@angular/core';
import { IPluginWithUI } from '../i-plugin';
import { PluginOverlayService } from '../service/plugin-overlay.service';
import { OverlayControllerComponent } from './overlay-test/overlay-controller.component';
import { OverlayObject } from '../overlay-object';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';

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
    private pluginOverlayService: PluginOverlayService
  ) {}

  initialize(): void {
    // 監視ロジックは PluginOverlayService 側に集約されたため、
    // ここでは初期化時に特別なことをする必要はありません。
  }

  initializeUI(injector: Injector): void {}

  /**
   * 基盤を使って新しい演出を作成します。
   */
  createTestOverlay(type: string, label: string) {
    const obj = this.pluginOverlayService.createOverlay(type);
    obj.label = label;
    // テスト用に少しランダムな位置に配置
    obj.left = 30 + Math.random() * 40;
    obj.top = 30 + Math.random() * 40;
    
    // コンテンツ（画像）のダミーセット
    obj.updateContent('url', './assets/images/ic_account_circle_black_24dp_2x.png');
    
    // 即座にフェードイン演出を追加
    obj.addTask('fade-in', 500);
    
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
