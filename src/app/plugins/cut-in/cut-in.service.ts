import { Injectable } from '@angular/core';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { PluginDataContainer } from '../../class/plugin-data-container';
import { PluginHelperService } from '../service/plugin-helper.service';
import { PluginDataObserverService } from '../service/plugin-data-observer.service';
import { CutIn } from './cut-in.model';
import { ChatListenerService } from '../service/chat-listener.service';
import { CutInPlaybackService } from './cut-in-playback.service';
import { PluginMapperService, MappingOptions } from '../service/plugin-mapper.service';
import { DataElement } from '@udonarium/data-element';

@Injectable({
  providedIn: 'root'
})
export class CutInService {
  private readonly PLUGIN_ID = 'cut-in';

  private readonly MAPPING_OPTIONS: MappingOptions = {
    tagMap: { 'cutIns': 'cut-in-list' },
    arrayItemNames: { 'cutIns': 'cut-in' },
    attrProps: ['identifier']
  };

  private container: PluginDataContainer | null = null;
  private _cutIns: CutIn[] = [];

  constructor(
    private pluginHelper: PluginHelperService,
    private observerService: PluginDataObserverService,
    private chatListenerService: ChatListenerService,
    private playbackService: CutInPlaybackService,
    private mapperService: PluginMapperService
  ) {
    this.initialize();
  }

  get cutIns(): CutIn[] {
    return this._cutIns;
  }

  private initialize() {
    // PluginDataContainerの監視を開始
    this.observerService.observe(
      this,
      this.PLUGIN_ID,
      '',
      container => {
        this.container = container;
        this.loadFromContainer();
      }
    );
  }

  private loadFromContainer() {
    if (!this.container) {
      this._cutIns = [];
      this.updateChatListeners();
      return;
    }

    // childrenから 'cut-in-list' を探す
    const listElement = this.container.children.find(child => child instanceof DataElement && child.name === 'cut-in-list') as DataElement;
    
    if (listElement) {
      const result = this.mapperService.fromElement<{ cutIns: CutIn[] }>(listElement, this.MAPPING_OPTIONS);
      this._cutIns = result.cutIns || [];
      console.log('[CutInService] Loaded cut-ins (XML):', this._cutIns.length);
    } else {
      // 後方互換性：古いJSON形式があれば読み込む
      if (this.container.data) {
        try {
          this._cutIns = JSON.parse(this.container.data);
          console.log('[CutInService] Loaded cut-ins (Legacy JSON):', this._cutIns.length);
          // 即座にXML形式へ変換保存を試みる
          this.saveToContainer();
        } catch (e) {
          console.error('[CutInService] Failed to parse legacy JSON:', e);
          this._cutIns = [];
        }
      } else {
        this._cutIns = [];
      }
    }
    this.updateChatListeners();
  }

  private saveToContainer() {
    if (!this.container) {
      this.container = this.pluginHelper.getOrCreateContainer(this.PLUGIN_ID);
    }

    // 既存のXML構造をクリア
    const oldList = this.container.children.find(child => child instanceof DataElement && child.name === 'cut-in-list');
    if (oldList) {
      this.container.removeChild(oldList);
    }

    // データをXML(DataElement)化して追加
    const listElement = this.mapperService.toElement('cutIns', this._cutIns, this.MAPPING_OPTIONS);
    this.container.appendChild(listElement);

    // 古いJSONデータフィールドをクリア
    this.container.data = '';
    
    this.container.update();
    this.updateChatListeners();
  }

  /**
   * チャットキーワード監視を最新のリストで更新する
   */
  private updateChatListeners() {
    this.chatListenerService.removeRulesByOwner(this);

    for (const cutIn of this._cutIns) {
      if (!cutIn.keyword) continue;

      this.chatListenerService.addRule({
        owner: this,
        name: `cutin-${cutIn.identifier}`,
        keyword: cutIn.keyword,
        callback: () => {
          this.playbackService.play(cutIn);
        }
      });
    }
  }

  addCutIn(cutIn: CutIn) {
    if (!cutIn.identifier) {
      cutIn.identifier = crypto.randomUUID();
    }
    this._cutIns.push(cutIn);
    this.saveToContainer();
  }

  updateCutIn(updated: CutIn) {
    const index = this._cutIns.findIndex(c => c.identifier === updated.identifier);
    if (index !== -1) {
      this._cutIns[index] = updated;
      this.saveToContainer();
    }
  }

  deleteCutIn(identifier: string) {
    this._cutIns = this._cutIns.filter(c => c.identifier !== identifier);
    this.saveToContainer();
  }

  getCutInById(identifier: string): CutIn | undefined {
    return this._cutIns.find(c => c.identifier === identifier);
  }
}
