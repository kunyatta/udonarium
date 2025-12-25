import { ComponentRef, Injectable, Type, ViewContainerRef } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class PluginOverlayService {

  // 本体側(AppComponent)からセットされる、コンポーネントを挿入するためのコンテナ
  static defaultParentViewContainerRef: ViewContainerRef;

  constructor() { }

  /**
   * 指定されたコンポーネントを最前面レイヤーに動的に生成・表示します。
   * @param component 表示したいコンポーネントクラス
   * @returns 生成されたコンポーネントの参照 (ComponentRef)
   */
  show<T>(component: Type<T>): ComponentRef<T> {
    if (!PluginOverlayService.defaultParentViewContainerRef) {
      console.warn('PluginOverlayService: ViewContainerRef is not set.');
      return null;
    }
    // コンポーネントを動的に生成してコンテナに追加
    return PluginOverlayService.defaultParentViewContainerRef.createComponent(component);
  }

  /**
   * 全てのオーバーレイ要素を削除します（必要に応じて実装）
   */
  clear() {
    if (PluginOverlayService.defaultParentViewContainerRef) {
      PluginOverlayService.defaultParentViewContainerRef.clear();
    }
  }
}
