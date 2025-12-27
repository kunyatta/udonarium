import { ComponentRef, Injectable, Type, ViewContainerRef, NgZone } from '@angular/core';
import { OverlayComponent } from '../components/overlay/overlay.component';
import { OverlayObject } from '../overlay-object';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { EventSystem } from '@udonarium/core/system';
import { ObjectFactory } from '@udonarium/core/synchronize-object/object-factory';

@Injectable({
  providedIn: 'root'
})
export class PluginOverlayService {

  // 本体側(AppComponent)からセットされるコンテナ
  static defaultParentViewContainerRef: ViewContainerRef;

  // identifier をキーとして生成済みのコンポーネントを管理
  private componentMap: Map<string, ComponentRef<OverlayComponent>> = new Map();

  constructor(private ngZone: NgZone) { }

  /**
   * サービスの初期化。GameObject の監視を開始します。
   */
  initialize() {
    // 演出用 GameObject を登録
    ObjectFactory.instance.register(OverlayObject, 'overlay-object');

    EventSystem.register(this)
      .on('UPDATE_GAME_OBJECT', event => {
        // OverlayObject が作成・更新されたらコンポーネントの同期を確認
        if (event.data.aliasName === 'overlay-object') {
          this.syncComponents();
        }
      })
      .on('DELETE_GAME_OBJECT', event => {
        // OverlayObject が削除されたらコンポーネントも破棄
        if (this.componentMap.has(event.data.identifier)) {
          this.destroyComponent(event.data.identifier);
        }
      })
      .on('XML_LOADED', () => {
        // ルームデータ読込時は一旦全てクリアして再同期
        this.clear();
        this.syncComponents();
      });

    // 起動時に既に存在するオブジェクトを同期
    this.syncComponents();
  }

  /**
   * 新しいオーバーレイ演出を作成します。
   * @param type 演出タイプ ('standing', 'cutin' 等)
   * @returns 作成された OverlayObject
   */
  createOverlay(type: string = 'generic'): OverlayObject {
    const obj = new OverlayObject();
    obj.type = type;
    obj.initialize(); // identifier 発行
    ObjectStore.instance.add(obj);
    // syncComponents は UPDATE_GAME_OBJECT イベント経由で自動実行される
    return obj;
  }

  /**
   * 指定されたコンポーネントを動的に生成します。
   * 基盤以外から直接呼ぶことは想定していませんが、互換性のために残します。
   */
  show<T>(component: Type<T>): ComponentRef<T> {
    if (!PluginOverlayService.defaultParentViewContainerRef) {
      console.warn('PluginOverlayService: ViewContainerRef is not set.');
      return null;
    }
    return PluginOverlayService.defaultParentViewContainerRef.createComponent(component);
  }

  /**
   * 全てのオーバーレイ要素を削除します。
   */
  clear() {
    for (const id of this.componentMap.keys()) {
      this.destroyComponent(id);
    }
    if (PluginOverlayService.defaultParentViewContainerRef) {
      PluginOverlayService.defaultParentViewContainerRef.clear();
    }
  }

  /**
   * ObjectStore 内の OverlayObject と画面上のコンポーネントを同期させます。
   */
  private syncComponents() {
    this.ngZone.run(() => {
      const objects = ObjectStore.instance.getObjects<OverlayObject>(OverlayObject);
      
      for (const obj of objects) {
        if (!this.componentMap.has(obj.identifier)) {
          this.createOverlayComponent(obj);
        }
      }
    });
  }

  /**
   * ローカル（自分だけ）のオーバーレイ演出を作成します。P2P同期されません。
   * @param type 演出タイプ
   * @returns 作成された OverlayObject
   */
  createLocalOverlay(type: string = 'generic'): OverlayObject {
    const obj = new OverlayObject(); // constructorでidentifierは生成される
    obj.type = type;
    obj.createRequiredElements(); // 手動で初期化
    
    // initialize() を呼ばないことで ObjectStore への追加（P2P同期）を回避
    
    this.ngZone.run(() => {
      this.createOverlayComponent(obj);
    });
    
    return obj;
  }

  /**
   * ローカルのオーバーレイ演出を破棄します。
   * @param identifier オブジェクトの識別子
   */
  destroyLocalOverlay(identifier: string) {
    this.destroyComponent(identifier);
  }

  /**
   * 実際の OverlayComponent インスタンスを作成し、Input をセットします。
   */
  private createOverlayComponent(obj: OverlayObject) {
    if (!PluginOverlayService.defaultParentViewContainerRef) return;

    const ref = PluginOverlayService.defaultParentViewContainerRef.createComponent(OverlayComponent);
    ref.instance.overlayObject = obj; // オブジェクトを直接セット
    ref.instance.overlayObjectIdentifier = obj.identifier;
    ref.changeDetectorRef.markForCheck();
    
    this.componentMap.set(obj.identifier, ref);
  }

  /**
   * 特定の演出コンポーネントを破棄します。
   */
  private destroyComponent(identifier: string) {
    const ref = this.componentMap.get(identifier);
    if (ref) {
      ref.destroy();
      this.componentMap.delete(identifier);
    }
  }
}