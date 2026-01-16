import { Injectable } from '@angular/core';
import { PluginDataContainer } from '../../class/plugin-data-container';
import { PluginHelperService } from '../service/plugin-helper.service';
import { PluginDataObserverService } from '../service/plugin-data-observer.service';
import { PluginMapperService, MappingOptions } from '../service/plugin-mapper.service';
import { PluginDataTransferService } from '../service/plugin-data-transfer.service';
import { ConfigItem, DEFAULT_CONFIG_ITEM } from './config-panel-test.model';
import { DataElement } from '@udonarium/data-element';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ConfigPanelTestService {
  readonly PLUGIN_ID = 'config-panel-test';
  readonly update$ = new Subject<void>();

  private readonly MAPPING_OPTIONS: MappingOptions = {
    tagMap: { 'items': 'config-item-list' },
    arrayItemNames: { 'items': 'config-item' },
    attrProps: ['identifier', 'imageIdentifier'] // 重要：ここに含まれないと画像が収集されない
  };

  private container: PluginDataContainer | null = null;
  private _items: ConfigItem[] = [];

  constructor(
    private pluginHelper: PluginHelperService,
    private observerService: PluginDataObserverService,
    private mapperService: PluginMapperService,
    private pluginDataTransfer: PluginDataTransferService
  ) {
    console.log('[ConfigPanelTest] Service Constructed');
    this.initialize();
  }

  get items(): ConfigItem[] {
    return this._items;
  }

  private initialize() {
    this.observerService.observe(
      this,
      this.PLUGIN_ID,
      'default',
      container => {
        console.log('[ConfigPanelTest] Observer triggered.', container ? 'Container found.' : 'Container NOT found.');
        this.container = container;
        this.loadFromContainer();
      }
    );

    // データインポート時の処理登録
    this.pluginDataTransfer.register(this.PLUGIN_ID, (data: DataElement) => {
      console.log('[ConfigPanelTest] Import triggered.');
      this.importFromDataElement(data);
    });
  }

  private loadFromContainer() {
    if (!this.container) {
      console.log('[ConfigPanelTest] Container is null. Clearing items.');
      this._items = [];
      this.update$.next();
      return;
    }

    console.log('[ConfigPanelTest] Loading from container. Children count:', this.container.children.length);
    // デバッグ用：子要素の名前を列挙
    this.container.children.forEach(c => {
      if (c instanceof DataElement) {
        console.log('[ConfigPanelTest] Child DataElement:', c.name, c);
      } else {
        console.log('[ConfigPanelTest] Child (other):', c);
      }
    });

    const listElement = this.container.children.find(child => child instanceof DataElement && child.name === 'config-item-list') as DataElement;
    
    if (listElement) {
      console.log('[ConfigPanelTest] Found "config-item-list".', listElement);
      const result = this.mapperService.fromElement<{ items: ConfigItem[] }>(listElement, this.MAPPING_OPTIONS);
      const newItems = result.items || [];
      console.log('[ConfigPanelTest] Parsed items count:', newItems.length);
      
      // 既存の参照を維持して更新（UI側で編集中のオブジェクトが切れないように）
      // 1. 更新と追加
      for (const newItem of newItems) {
        const existing = this._items.find(i => i.identifier === newItem.identifier);
        if (existing) {
          Object.assign(existing, newItem);
        } else {
          this._items.push(newItem);
        }
      }
      // 2. 削除
      const newIds = new Set(newItems.map(i => i.identifier));
      for (let i = this._items.length - 1; i >= 0; i--) {
        if (!newIds.has(this._items[i].identifier)) {
          this._items.splice(i, 1);
        }
      }
    } else {
        console.warn('[ConfigPanelTest] "config-item-list" NOT found in container children.');
        // JSON形式の古いデータ（もしあれば）のケアなどはここで行うが、今回は新規なので不要
    }
    this.update$.next();
  }

  private saveToContainer() {
    if (!this.container) {
      this.container = this.pluginHelper.getOrCreateContainer(this.PLUGIN_ID, 'default');
    }

    // 既存のリスト要素を削除
    const oldList = this.container.children.find(child => child instanceof DataElement && child.name === 'config-item-list');
    if (oldList) {
      this.container.removeChild(oldList);
    }

    // 新しいデータを要素化して追加
    const listElement = this.mapperService.toElement('items', this._items, this.MAPPING_OPTIONS);
    this.container.appendChild(listElement);

    this.container.update(); // 同期発火
    this.update$.next();
  }

  /**
   * 外部からのインポート処理
   */
  private importFromDataElement(rootElement: DataElement) {
    let importedItems: ConfigItem[] = [];

    // ルート要素名で単体かリストかを判別
    if (rootElement.name === 'config-item-list') {
        const result = this.mapperService.fromElement<{ items: ConfigItem[] }>(rootElement, this.MAPPING_OPTIONS);
        importedItems = result.items || [];
    } else if (rootElement.name === 'config-item') {
        // 単体の場合はダミーのリストに入れてパースさせる
        const wrapper = DataElement.create('config-item-list', '', {}, '');
        // 要素を破壊しないようクローンした方が安全だが、DataElementの実装依存。
        // ここでは簡易的に直結するが、本来は import 用にDeepCopyなどが望ましい場合もある。
        wrapper.appendChild(rootElement); 
        const result = this.mapperService.fromElement<{ items: ConfigItem[] }>(wrapper, this.MAPPING_OPTIONS);
        importedItems = result.items || [];
    }

    if (importedItems.length === 0) return;

    // インポートされたデータは新しいIDで追加する（既存の上書きではない）
    for (const item of importedItems) {
        item.identifier = this.generateUUID(); // 新規ID
        this._items.push(item);
    }
    this.saveToContainer();
  }

  // --- 公開メソッド ---

  add(item: Omit<ConfigItem, 'identifier'>) {
    const newItem: ConfigItem = {
      ...item,
      identifier: this.generateUUID()
    };
    this._items.push(newItem);
    this.saveToContainer();
    return newItem;
  }

  update(item: ConfigItem) {
    // 参照を共有している場合はsaveだけで良いが、明示的に受け取る
    const index = this._items.findIndex(i => i.identifier === item.identifier);
    if (index !== -1) {
      this._items[index] = item;
      this.saveToContainer();
    }
  }

  delete(identifier: string) {
    this._items = this._items.filter(i => i.identifier !== identifier);
    this.saveToContainer();
  }

  getItem(identifier: string): ConfigItem | undefined {
    return this._items.find(i => i.identifier === identifier);
  }

  // --- エクスポート用 ---

  getExportDataElement(identifier: string): DataElement | null {
    const item = this.getItem(identifier);
    if (!item) return null;
    
    // 単体エクスポート：リスト形式にしてから中身を取り出すのが一番確実
    const listElement = this.mapperService.toElement('items', [item], this.MAPPING_OPTIONS);
    return listElement.children[0] as DataElement;
  }

  getAllExportDataElement(): DataElement {
    return this.mapperService.toElement('items', this._items, this.MAPPING_OPTIONS);
  }

  private generateUUID(): string {
    return crypto.randomUUID();
  }
}
