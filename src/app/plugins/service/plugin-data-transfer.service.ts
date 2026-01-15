import { Injectable, OnDestroy } from '@angular/core';
import { DataElement } from '@udonarium/data-element';
import { EventSystem } from '@udonarium/core/system';
import { XmlUtil } from '@udonarium/core/system/util/xml-util';
import { SaveDataService } from '../../service/save-data.service';
import { ObjectSerializer } from '@udonarium/core/synchronize-object/object-serializer';

/**
 * プラグインの部分的なデータ（設定、辞書アイテムなど）を転送（インポート/エクスポート）するための共通基盤サービス。
 */
@Injectable({
  providedIn: 'root'
})
export class PluginDataTransferService implements OnDestroy {
  private handlers = new Map<string, (data: DataElement) => void>();
  private readonly ROOT_TAG = 'plugin-export-data';
  private readonly LEGACY_COMBAT_FLOW_TAG = 'status-effect-data';

  constructor(private saveDataService: SaveDataService) {
    this.registerEvents();
  }

  ngOnDestroy() {
    EventSystem.unregister(this);
  }

  private registerEvents() {
    EventSystem.register(this).on('XML_LOADED', async event => {
      const xmlElement: Element = event.data.xmlElement;
      if (!xmlElement) return;

      // 新フォーマットの検知
      if (xmlElement.tagName === 'data' && xmlElement.getAttribute('name') === this.ROOT_TAG) {
        this.handleImport(xmlElement);
      } 
      // レガシー対応: CombatFlow
      else if (xmlElement.tagName === 'data' && xmlElement.getAttribute('name') === this.LEGACY_COMBAT_FLOW_TAG) {
        this.routeToPlugin('combat-flow', xmlElement);
      }
    });
  }

  /**
   * インポートハンドラを登録します。
   */
  register(pluginId: string, callback: (data: DataElement) => void): void {
    this.handlers.set(pluginId, callback);
  }

  /**
   * インポートされたXML要素を解析し、適切なプラグインにルーティングします。
   */
  private handleImport(rootElement: Element): void {
    const targetPluginId = this.getChildValue(rootElement, 'targetPluginId');
    const payloadElement = Array.from(rootElement.children).find(
      child => child.tagName === 'data' && child.getAttribute('name') === 'payload'
    );

    if (targetPluginId && payloadElement && payloadElement.firstElementChild) {
      this.routeToPlugin(targetPluginId, payloadElement.firstElementChild as Element);
    }
  }

  /**
   * データを DataElement に変換し、指定されたプラグインハンドラに渡します。
   */
  private routeToPlugin(pluginId: string, element: Element): void {
    const handler = this.handlers.get(pluginId);
    if (!handler) {
      console.warn(`[PluginDataTransfer] No handler registered for plugin: ${pluginId}`);
      return;
    }

    try {
      // Element -> DataElement への変換 (ObjectSerializerを利用)
      const dataElement = ObjectSerializer.instance.parseXml(element) as DataElement;
      if (dataElement) {
        handler(dataElement);
      }
    } catch (e) {
      console.error(`[PluginDataTransfer] Failed to parse imported data for ${pluginId}:`, e);
    }
  }

  /**
   * データを共通フォーマットでエクスポート（保存）します。
   */
  async export(
    pluginId: string,
    fileName: string,
    data: DataElement,
    options: { type: 'zip' | 'xml' } = { type: 'zip' }
  ): Promise<void> {
    const root = DataElement.create(this.ROOT_TAG, '', {});
    root.appendChild(DataElement.create('targetPluginId', pluginId, {}));
    
    const payload = DataElement.create('payload', '', {});
    payload.appendChild(data);
    root.appendChild(payload);

    if (options.type === 'xml') {
      await this.saveDataService.saveXmlAsync(root.toXml(), fileName);
    } else {
      await this.saveDataService.saveDataElementAsync(root, 'data', fileName, true);
    }
  }

  /**
   * 指定されたURLから初期データを取得し、インポートします。
   */
  async loadDefaultData(pluginId: string, url: string): Promise<void> {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const xmlText = await response.text();
      const xmlElement = XmlUtil.xml2element(xmlText);
      
      if (!xmlElement) throw new Error('Failed to parse XML');

      // 取得したデータが共通フォーマットなら handleImport、そうでなければ直接ルーティング
      if (xmlElement.tagName === 'data' && xmlElement.getAttribute('name') === this.ROOT_TAG) {
        this.handleImport(xmlElement);
      } else {
        this.routeToPlugin(pluginId, xmlElement);
      }
    } catch (e) {
      console.error(`[PluginDataTransfer] Failed to load default data for ${pluginId} from ${url}:`, e);
    }
  }

  private getChildValue(parent: Element, name: string): string | null {
    const el = Array.from(parent.children).find(
      child => child.tagName === 'data' && child.getAttribute('name') === name
    );
    return el ? XmlUtil.decodeEntityReference(el.textContent || '') : null;
  }
}
