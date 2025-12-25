import { ComponentRef, Injectable, Injector, NgZone } from '@angular/core';
import { IPluginWithUI } from '../i-plugin';
import { PluginOverlayService } from '../service/plugin-overlay.service';
import { OverlayTestComponent } from './overlay-test/overlay-test.component';
import { OverlayControllerComponent } from './overlay-test/overlay-controller.component';
import { OverlayTestObject } from './overlay-test-object';
import { EventSystem } from '@udonarium/core/system';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { ObjectFactory } from '@udonarium/core/synchronize-object/object-factory';

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
  height: number = 350;

  private componentRefs = new Map<string, ComponentRef<OverlayTestComponent>>();

  constructor(
    private pluginOverlayService: PluginOverlayService
  ) {}

  initialize(): void {
    // アーキテクチャに則り、GameObjectを登録
    ObjectFactory.instance.register(OverlayTestObject, 'overlay-test');

    // 既存のオブジェクトがあれば表示
    const existing = ObjectStore.instance.getObjects<OverlayTestObject>(OverlayTestObject);
    for (const obj of existing) {
      this.createView(obj);
    }

    // 新しいオブジェクトの出現を監視
    EventSystem.register(this)
      .on('UPDATE_GAME_OBJECT', event => {
        if (event.data.aliasName === 'overlay-test') {
          const obj = ObjectStore.instance.get<OverlayTestObject>(event.data.identifier);
          if (obj && !this.componentRefs.has(obj.identifier)) {
            this.createView(obj);
          }
        }
      })
      .on('DELETE_GAME_OBJECT', event => {
        const ref = this.componentRefs.get(event.data.identifier);
        if (ref) {
          ref.destroy();
          this.componentRefs.delete(event.data.identifier);
        }
      });
  }

  initializeUI(injector: Injector): void {}

  /**
   * 新しい同期オブジェクトを作成します（これが全プレイヤーに飛ぶ）
   */
  createOverlay(top: number, left: number, opacity: number) {
    const obj = new OverlayTestObject();
    obj.top = top;
    obj.left = left;
    obj.opacity = opacity;
    obj.initialize(); // これで同期が開始される
  }

  /**
   * オブジェクトに対応する View (Component) を生成します
   */
  private createView(obj: OverlayTestObject) {
    if (this.componentRefs.has(obj.identifier)) return;

    const ref = this.pluginOverlayService.show(OverlayTestComponent);
    if (ref) {
      ref.instance.overlayObjectIdentifier = obj.identifier;
      this.componentRefs.set(obj.identifier, ref);
    }
  }

  /**
   * 全てのデータを消去します
   */
  clearAll() {
    const existing = ObjectStore.instance.getObjects<OverlayTestObject>(OverlayTestObject);
    for (const obj of existing) {
      obj.destroy();
    }
  }
}