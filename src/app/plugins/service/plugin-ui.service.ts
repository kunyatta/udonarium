import { Injectable, Type, ComponentRef } from '@angular/core';
import { ModalService } from '../../service/modal.service';
import { PanelService, PanelOption as OriginalPanelOption } from '../../service/panel.service';
import { PointerDeviceService } from '../../service/pointer-device.service';
import { UIPanelComponent } from '../../component/ui-panel/ui-panel.component';
import { AutoLayoutPanelComponent } from '../components/auto-layout-panel/auto-layout-panel.component';
import { EventSystem } from '@udonarium/core/system';

// 元のPanelOptionを拡張して、カスタムプロパティを含めます。
export interface PluginPanelOption extends OriginalPanelOption {
  isSingleton?: boolean;
  panelType?: 'parent' | 'child';
  inputs?: { [key: string]: any };
  layout?: 'full-auto' | 'hybrid'; // layoutオプションを復活
  position?: 'center' | 'default'; // 中央表示オプションを追加
  keepOnRoomLoad?: boolean; // ルームロード時にパネルを維持するかどうか
  align?: 'top-left' | 'top-center' | 'top-right' | 'center-left' | 'center' | 'center-right' | 'bottom-left' | 'bottom-center' | 'bottom-right' | 'bottom'; // 配置の基準点（デフォルト: top-left）
  offsetX?: number; // X軸オフセット
  offsetY?: number; // Y軸オフセット
}

// シングルトン機能を必要としないプラグインのために、元のPanelOptionを再エクスポートします。
export { OriginalPanelOption as PanelOption };

@Injectable({
  providedIn: 'root'
})
export class PluginUiService {

  private openPanels: Map<string, { ref: ComponentRef<UIPanelComponent>, option: PluginPanelOption }> = new Map();
  private singletonPanelIds: Map<any, string> = new Map();
  private parentPanelCount = 0;
  private lastPanelId: string;
  private lastPanelOption: PluginPanelOption;

  constructor(
    private modalService: ModalService,
    private panelService: PanelService,
    private pointerDeviceService: PointerDeviceService
  ) {
    // onPanelOpenコールバックをフックして、開かれたパネルを追跡する
    PanelService.onPanelOpen = (panelRef: ComponentRef<UIPanelComponent>, componentType: any) => {
      this.handlePanelOpen(this.lastPanelId, panelRef, componentType, this.lastPanelOption);
      this.lastPanelId = null;
      this.lastPanelOption = null;
    };

    // ルームロード時にプラグインパネルを一括で閉じる
    EventSystem.register(this).on('XML_LOADED', event => {
      const xmlElement: Element = event.data.xmlElement;
      // ルームデータ（<data name="room"> または <room>）が読み込まれた時のみ、全パネルを閉じる
      // 部分的なデータロード（プラグイン設定や画像追加）ではパネルを維持する（Udonarium標準挙動準拠）
      if (xmlElement && (xmlElement.getAttribute('name') === 'room' || xmlElement.tagName === 'room')) {
        this.closeAllOnRoomLoad();
      }
    });
  }

  private handlePanelOpen(panelId: string, panelRef: ComponentRef<UIPanelComponent>, componentType: any, option: PluginPanelOption): void {
    if (!panelId) return;

    // コンテキストチェック (instance.contextが存在するか確認)
    const instance = panelRef.instance as any;
    const isParentPanel = instance.context?.panelType === 'parent';

    this.openPanels.set(panelId, { ref: panelRef, option: option || {} });

    panelRef.onDestroy(() => {
      this.openPanels.delete(panelId);
      if (this.singletonPanelIds.get(componentType) === panelId) {
        this.singletonPanelIds.delete(componentType);
      }
      if (isParentPanel) {
        this.parentPanelCount = Math.max(0, this.parentPanelCount - 1);
      }
    });
  }

  private closeAllOnRoomLoad(): void {
    // 逆順にコピーして処理（削除による影響を最小限にするため、およびMap変更への対応）
    const panelEntries = Array.from(this.openPanels.entries());
    for (const [panelId, data] of panelEntries) {
      if (!data.option?.keepOnRoomLoad) {
        data.ref.destroy();
      }
    }
  }

  open<T>(component: Type<T>, option: PluginPanelOption = {}): T {
    // シングルトンが指定されている場合、既存のパネルがあれば閉じる
    if (option.isSingleton) {
      const existingPanelId = this.singletonPanelIds.get(component);
      if (existingPanelId && this.openPanels.has(existingPanelId)) {
        this.openPanels.get(existingPanelId).ref.destroy();
      }
    }

    const panelId = crypto.randomUUID();
    this.lastPanelId = panelId;
    this.lastPanelOption = option;

    if (option.isSingleton) {
      this.singletonPanelIds.set(component, panelId);
    }

    const width = option.width || 300;
    const height = option.height || 200;
    const panelType = option.panelType || 'parent';

    // 1. ベース座標の決定
    let left = option.left;
    let top = option.top;

    if (option.position === 'center') {
      left = (window.innerWidth - width) / 2;
      top = (window.innerHeight - height) / 2;
    } else if (left === undefined || top === undefined) {
      if (panelType === 'parent') {
        if (top === undefined) {
          top = (this.parentPanelCount % 10 + 1) * 20;
        }
        if (left === undefined) {
          left = 100 + (this.parentPanelCount % 20 + 1) * 5;
        }
      } else { // 'child' (引数なしで呼ばれた場合のフォールバック)
        const coordinate = this.pointerDeviceService.pointers[0];
        if (!coordinate) {
          left = window.innerWidth / 2 - width / 2;
          top = window.innerHeight / 2 - height / 2;
        } else {
          left = coordinate.x - 200;
          top = coordinate.y - 150;
        }
      }
    }

    // 2. アライメント調整 (9パターン対応)
    switch (option.align) {
      case 'top-center':
        left -= width / 2;
        break;
      case 'top-right':
        left -= width;
        break;
      case 'center-left':
        top -= height / 2;
        break;
      case 'center':
        left -= width / 2;
        top -= height / 2;
        break;
      case 'center-right':
        left -= width;
        top -= height / 2;
        break;
      case 'bottom-left':
        top -= height;
        break;
      case 'bottom': // エイリアス
      case 'bottom-center':
        left -= width / 2;
        top -= height;
        break;
      case 'bottom-right':
        left -= width;
        top -= height;
        break;
      case 'top-left':
      default:
        // top-left は計算不要 (0, 0)
        break;
    }

    // 3. オフセット適用
    left += (option.offsetX || 0);
    top += (option.offsetY || 0);

    // 4. 共通のクランプ処理（画面外へのはみ出し防止）
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const marginX = 20;
    const marginY = 40; 
    
    // 右下のはみ出しをクランプ
    if (left + width > windowWidth) {
      left = windowWidth - width - marginX;
    }
    if (top + height > windowHeight) {
      top = windowHeight - height - marginY;
    }
    // 左上のはみ出しをクランプ（上端にもマージンを設ける）
    left = Math.max(marginX / 2, left);
    top = Math.max(8, top); // タイトルバーが隠れない程度に

    // 確定した座標をオプションに書き戻す
    option.left = left;
    option.top = top;
    
    let componentToOpen: Type<any> = component;
    let finalInputs: any = option.inputs || {};

    // layoutオプションが指定された場合、AutoLayoutPanelでラップする
    if (option.layout) {
      finalInputs = {
        panelId: panelId, // AutoLayoutPanelにpanelIdを渡す
        componentToHost: component,
        componentInputs: option.inputs,
      };
      componentToOpen = AutoLayoutPanelComponent;
    }

    const componentInstance = this.panelService.open(componentToOpen, option);

    // inputsを手動で設定
    setTimeout(() => {
      for (const key in finalInputs) {
        if (finalInputs.hasOwnProperty(key)) {
          (componentInstance as any)[key] = finalInputs[key];
        }
      }
    }, 0);

    return componentInstance as T;
  }

  openAtCursor<T>(component: Type<T>, option: PluginPanelOption = {}, coordinate?: { x: number, y: number }): T {
    // 外部からの座標指定がなければ PointerDeviceService から取得
    const basePointer = coordinate || this.pointerDeviceService.pointer;

    const finalOption = {
      ...option,
      left: option.left ?? basePointer.x,
      top: option.top ?? basePointer.y
    };

    // リファクタリングされた open を呼び出す。
    return this.open(component, finalOption);
  }
  
  resizePanel(panelId: string, width: number, height: number): void {
    const data = this.openPanels.get(panelId);
    if (data) {
      const panelComponent = data.ref.instance;
      // パネルのChrome（タイトルバー、パディング、ボーダーなど）のおおよそのサイズ
      // UIPanelComponentのCSS/HTML構造に基づく
      // titleBar: 25px, padding: 8px * 2 = 16px, border: 2px?
      // ここでは安全マージン込みで少し大きめに取る
      const PANEL_CHROME_WIDTH = 36; 
      const PANEL_CHROME_HEIGHT = 45; 

      // コンテンツサイズに基づいてパネル全体のサイズを設定
      // ceilで整数化して滲みを防ぐ
      panelComponent.width = Math.ceil(width + PANEL_CHROME_WIDTH);
      panelComponent.height = Math.ceil(height + PANEL_CHROME_HEIGHT);
    }
  }

  updatePanel(panelId: string, option: { width?: number, height?: number, left?: number, top?: number }): void {
    const data = this.openPanels.get(panelId);
    if (data) {
      const panelComponent = data.ref.instance;
      const PANEL_CHROME_WIDTH = 36; 
      const PANEL_CHROME_HEIGHT = 45;

      if (option.width !== undefined) {
        panelComponent.width = Math.ceil(option.width + PANEL_CHROME_WIDTH);
      }
      if (option.height !== undefined) {
        panelComponent.height = Math.ceil(option.height + PANEL_CHROME_HEIGHT);
      }
      if (option.left !== undefined) {
        panelComponent.left = option.left;
      }
      if (option.top !== undefined) {
        panelComponent.top = option.top;
      }
    }
  }

  close(component: Type<any>): void {
    const panelId = this.singletonPanelIds.get(component);
    if (panelId && this.openPanels.has(panelId)) {
      this.openPanels.get(panelId).ref.destroy();
    }
  }

  find<T>(component: Type<T>): T | undefined {
    const panelId = this.singletonPanelIds.get(component);
    if (panelId && this.openPanels.has(panelId)) {
      const data = this.openPanels.get(panelId);
      const instance = data.ref.instance;
      
      if (instance instanceof AutoLayoutPanelComponent) {
        // AutoLayoutPanel内の動的コンポーネントを取得
        // dynamicContentHost は ViewContainerRef なので、そこから取得できるか？
        // ViewContainerRef.get(0) は ViewRef を返すが、ComponentRefではない場合もある。
        // しかし createComponent で作っているので ComponentRef が取れるはずだが、
        // ViewContainerRef APIでは ComponentRef を直接取得できない。
        // なので、AutoLayoutPanelComponent 側で保持している参照にアクセスするのが確実だが、
        // 現状の実装では保持していない。
        // 簡易的な方法として、injectorから探す
        try {
          // AutoLayoutPanelComponentのViewContainerRefからinjectorを取得し、そこから探す
          return instance.dynamicContentHost.injector.get(component);
        } catch (e) {
          console.warn('Could not find component instance in AutoLayoutPanel', e);
          return undefined;
        }
      } else {
        return instance as T;
      }
    }
    return undefined;
  }

  openAsModal<T>(component: Type<T>, option?: { title?: string }): Promise<any> {
    return this.modalService.open(component, option);
  }
}