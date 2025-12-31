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
  // 型を any に広げる（OverlayComponent 以外のカスタムコンポーネントも許可するため）
  private componentMap: Map<string, ComponentRef<any>> = new Map();

  // 演出タイプごとのレンダラー・コンポーネントのレジストリ
  private rendererRegistry: Map<string, Type<any>> = new Map();

  constructor(private ngZone: NgZone) { }

  /**
   * 演出タイプに対応するコンポーネントを登録します。
   * @param type 演出タイプ ('standing' 等)
   * @param component 描画に使用するコンポーネントクラス
   */
  registerRenderer(type: string, component: Type<any>) {
    this.rendererRegistry.set(type, component);
    console.log(`[PluginOverlayService] Registered renderer for type: ${type}`);
  }

  /**
   * サービスの初期化。GameObject の監視を開始します。
   */
  initialize() {
    // 演出用 GameObject を登録
    ObjectFactory.instance.register(OverlayObject, 'overlay-object');

    EventSystem.register(this)
      .on('ADD_GAME_OBJECT', event => {
        // OverlayObject が作成されたらコンポーネントの同期を確認
        if (event.data.aliasName === 'overlay-object') {
          this.syncComponents();
        }
      })
      .on('UPDATE_GAME_OBJECT', event => {
        // OverlayObject が更新されたらコンポーネントの同期を確認
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
        // ルームデータ読込時はコンポーネントを再同期
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
    return obj;
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
   */
  createLocalOverlay(type: string = 'generic'): OverlayObject {
    const obj = new OverlayObject();
    obj.type = type;
    obj.createRequiredElements();
    
    this.ngZone.run(() => {
      this.createOverlayComponent(obj);
    });
    
    return obj;
  }

  /**
   * ローカルのオーバーレイ演出を破棄します。
   */
  destroyLocalOverlay(identifier: string) {
    this.destroyComponent(identifier);
  }

  /**
   * 演出コンポーネント インスタンスを作成し、データをセットします。
   */
  private createOverlayComponent(obj: OverlayObject) {
    if (!PluginOverlayService.defaultParentViewContainerRef) return;

    // レジストリからコンポーネントを取得、なければデフォルトの OverlayComponent を使用
    const componentType = this.rendererRegistry.get(obj.type) || OverlayComponent;

    const ref = PluginOverlayService.defaultParentViewContainerRef.createComponent(componentType);
    
    // インスタンス作成直後、ngOnInit が実行される前にプロパティを流し込む
    const instance = ref.instance as any;
    instance.overlayObject = obj;
    instance.overlayObjectIdentifier = obj.identifier;
    
    // プロパティをセットし終えてから初期描画を走らせる（ここで ngOnInit が呼ばれる）
    ref.changeDetectorRef.detectChanges();
    
    if (ref.changeDetectorRef) {
      ref.changeDetectorRef.markForCheck();
    }
    
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

  /**
   * 指定されたコンポーネントを動的に生成します。
   * (古い show メソッド: 互換性のために残すが、現在は createOverlay 推奨)
   */
  show<T>(component: Type<T>): ComponentRef<T> {
    if (!PluginOverlayService.defaultParentViewContainerRef) {
      console.warn('PluginOverlayService: ViewContainerRef is not set.');
      return null;
    }
    return PluginOverlayService.defaultParentViewContainerRef.createComponent(component);
  }
}