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
    EventSystem.register(this).on('XML_LOADED', () => {
      this.closeAllOnRoomLoad();
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

    const panelType = option.panelType || 'parent';

    // 中央配置ロジック
    if (option.position === 'center') {
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      const width = option.width || 300; // デフォルト幅
      const height = option.height || 200; // デフォルト高さ

      option.left = (windowWidth - width) / 2;
      option.top = (windowHeight - height) / 2;

      // 画面外に出ないように調整
      option.left = Math.max(0, option.left);
      option.top = Math.max(0, option.top);

    } else if (panelType === 'parent') {
      if (option.top === undefined) {
        option.top = (this.parentPanelCount % 10 + 1) * 20;
      }
      if (option.left === undefined) {
        option.left = 100 + (this.parentPanelCount % 20 + 1) * 5;
      }
      // handlePanelOpenでカウントアップする
    } else { // 'child'
      const coordinate = this.pointerDeviceService.pointers[0];
      if (!coordinate) {
        option.left = window.innerWidth / 2 - 200;
        option.top = window.innerHeight / 2 - 150;
      }
      option.left = coordinate.x - 200;
      option.top = coordinate.y - 150;
    }
    
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
      // option.inputs は削除しないと、AutoLayoutPanel自体に渡ってしまう可能性があるが
      // PanelService.open は option.inputs をサポートしていないので、後で手動設定する。
    }

    const componentInstance = this.panelService.open(componentToOpen, option);

    // inputsを手動で設定
    // コンポーネント生成直後にプロパティを変更するとNG0100エラーになるため、
    // setTimeoutで次のイベントループに遅延させる。
    setTimeout(() => {
      for (const key in finalInputs) {
        if (finalInputs.hasOwnProperty(key)) {
          (componentInstance as any)[key] = finalInputs[key];
        }
      }
      
      // ngOnChangesを手動でトリガーする必要がある場合はここで行う
      // (Angularのライフサイクル上、プロパティ変更だけではngOnChangesは呼ばれないため)
      // ただし、単純なプロパティセットで十分な場合が多い
    }, 0);

    // AutoLayoutPanelの場合、instanceはAutoLayoutPanelComponentになる。
    // 呼び出し元がT型（元のコンポーネント）を期待している場合はキャストが必要だが、
    // TypeScript上はそのまま返すしかない。
    // find()では中身を返すが、open()の戻り値はパネル直下のコンポーネントになる点に注意。
    return componentInstance as T;
  }

  openAtCursor<T>(component: Type<T>, option: PluginPanelOption = {}): T {
    // PointerDeviceService から現在のカーソル位置を取得
    const pointer = this.pointerDeviceService.pointer;

    // オプションに位置指定がない場合のみ、カーソル位置を適用
    let left = option.left ?? pointer.x;
    let top = option.top ?? pointer.y;

    // 幅と高さが指定されている場合、画面端からはみ出さないように調整
    if (option.width && option.height) {
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;

      if (left + option.width > windowWidth) {
        left = windowWidth - option.width - 20; // 20pxのマージン
      }
      if (top + option.height > windowHeight) {
        top = windowHeight - option.height - 20; // 20pxのマージン
      }
      // 左上が画面外に出ないようにする
      left = Math.max(0, left);
      top = Math.max(0, top);
    }

    const finalOption = {
      ...option,
      left: left,
      top: top
    };

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