import { Injectable } from '@angular/core';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { PluginDataContainer } from '../../class/plugin-data-container';
import { PluginHelperService } from '../service/plugin-helper.service';
import { PluginDataObserverService } from '../service/plugin-data-observer.service';
import { CutIn } from './cut-in.model';
import { ChatListenerService } from '../service/chat-listener.service';
import { CutInPlaybackService } from './cut-in-playback.service';

@Injectable({
  providedIn: 'root'
})
export class CutInService {
  private readonly PLUGIN_ID = 'cut-in-plugin';
  private readonly FILE_NAME_HINT = 'plugin_cutin';

  private container: PluginDataContainer | null = null;
  private _cutIns: CutIn[] = [];

  constructor(
    private pluginHelper: PluginHelperService,
    private observerService: PluginDataObserverService,
    private chatListenerService: ChatListenerService,
    private playbackService: CutInPlaybackService
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
      this.FILE_NAME_HINT,
      container => {
        this.container = container;
        this.loadFromContainer();
      }
    );
  }

  private loadFromContainer() {
    if (!this.container || !this.container.data) {
      this._cutIns = [];
      this.updateChatListeners();
      return;
    }

    try {
      this._cutIns = JSON.parse(this.container.data);
      console.log('[CutInService] Loaded cut-ins:', this._cutIns.length);
      this.updateChatListeners();
    } catch (e) {
      console.error('[CutInService] Failed to parse cut-in data:', e);
      this._cutIns = [];
      this.updateChatListeners();
    }
  }

  private saveToContainer() {
    if (!this.container) {
      this.container = this.pluginHelper.getOrCreateContainer(this.PLUGIN_ID, this.FILE_NAME_HINT);
    }

    this.container.data = JSON.stringify(this._cutIns);
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
