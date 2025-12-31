import { Injectable, OnDestroy } from '@angular/core';
import { UIExtensionService } from '../service/ui-extension.service';
import { ContextMenuService, ContextMenuAction } from '../../service/context-menu.service';
import { PluginDataObserverService } from '../service/plugin-data-observer.service';
import { PluginMapperService } from '../service/plugin-mapper.service';
import { PluginHelperService } from '../service/plugin-helper.service';
import { PluginDataContainer } from '../../class/plugin-data-container';
import { UUID } from '@udonarium/core/system/util/uuid';
import { DataElement } from '@udonarium/data-element';

export interface EmoteData {
  identifier?: string;
  icon: string;
  label: string;
  soundIdentifier?: string; // 将来用
}

@Injectable({
  providedIn: 'root'
})
export class EmoteManagerService implements OnDestroy {
  readonly PLUGIN_ID = 'dynamic-stand-emotes'; // 別のIDで管理

  // 管理データ
  emotes: EmoteData[] = [];
  
  // デフォルト値
  private readonly defaultEmotes: EmoteData[] = [
    { icon: '😊', label: '笑顔' },
    { icon: '😢', label: '悲しみ' },
    { icon: '💢', label: '怒り' },
    { icon: '😮', label: '驚き' },
    { icon: '🤔', label: '考え中' },
    { icon: '💦', label: '焦り' },
    { icon: '✨', label: '輝き' },
    { icon: '💡', label: '閃き' },
    { icon: '❗', label: '感嘆' },
    { icon: '❓', label: '疑問' }
  ];

  private observerSubscription: { unsubscribe: () => void } = null;
  private currentContainer: PluginDataContainer = null;
  private isSaving = false;

  constructor(
    private uiExtension: UIExtensionService,
    private contextMenu: ContextMenuService,
    private observer: PluginDataObserverService,
    private pluginMapper: PluginMapperService,
    private pluginHelper: PluginHelperService
  ) {}

  ngOnDestroy() {
    if (this.observerSubscription) this.observerSubscription.unsubscribe();
  }

  initialize() {
    this.registerUI();
    
    // データ監視
    this.observerSubscription = this.observer.observe(this, this.PLUGIN_ID, '', (container) => {
      if (this.isSaving) return;

      this.currentContainer = container;
      if (container && container.state.children.length > 0) {
        // XMLから復元
        // stateの下に <emote> が並んでいる想定
        const loadedEmotes: EmoteData[] = [];
        for (const child of container.state.children) {
          const loaded = this.pluginMapper.fromElement<EmoteData>(child as DataElement);
          if (loaded) loadedEmotes.push(loaded);
        }
        
        if (JSON.stringify(this.emotes) !== JSON.stringify(loadedEmotes)) {
          console.log('[EmoteManager] Loading remote data...');
          this.emotes = loadedEmotes;
        }
      } else {
        // 初回ロード時などでデータがない場合はデフォルトを使用し、保存する
        if (this.emotes.length === 0) {
          this.emotes = JSON.parse(JSON.stringify(this.defaultEmotes));
          // ID付与
          this.emotes.forEach(e => {
            if (!e.identifier) e.identifier = UUID.generateUuid();
          });
          
          setTimeout(() => {
            if (!this.currentContainer && !this.isSaving) {
              this.saveConfig();
            }
          }, 1000);
        }
      }
    });
  }

  saveConfig() {
    this.isSaving = true;
    try {
      if (!this.currentContainer) {
        this.currentContainer = this.pluginHelper.getOrCreateContainer(this.PLUGIN_ID, '');
      }

      // state の中身をクリアして再構築
      // 配列の各要素を DataElement に変換して追加
      this.currentContainer.state.children.forEach(child => child.destroy());
      
      this.emotes.forEach(emote => {
        // identifier がなければ生成
        if (!emote.identifier) emote.identifier = UUID.generateUuid();
        const elem = this.pluginMapper.toElement('emote', emote);
        this.currentContainer.state.appendChild(elem);
      });
      
      this.currentContainer.update();
    } finally {
      setTimeout(() => this.isSaving = false, 200);
    }
  }

  // CRUD
  addEmote(emote: EmoteData) {
    if (!emote.identifier) emote.identifier = UUID.generateUuid();
    this.emotes.push(emote);
    this.saveConfig();
  }

  updateEmote(emote: EmoteData) {
    const index = this.emotes.findIndex(e => e.identifier === emote.identifier);
    if (index >= 0) {
      this.emotes[index] = emote;
      this.saveConfig();
    }
  }

  deleteEmote(identifier: string) {
    const index = this.emotes.findIndex(e => e.identifier === identifier);
    if (index >= 0) {
      this.emotes.splice(index, 1);
      this.saveConfig();
    }
  }

  getEmotes(): EmoteData[] {
    return this.emotes;
  }

  private registerUI() {
    this.uiExtension.registerAction('chat-input', {
      name: 'エモート',
      icon: 'sentiment_satisfied_alt',
      action: (context: any, pointer: { x: number, y: number }) => this.openEmoteMenu(context, pointer),
      priority: 20
    });
  }

  private openEmoteMenu(context: any, pointer: { x: number, y: number }) {
    if (!pointer) return;

    const actions: ContextMenuAction[] = this.emotes.map(emote => ({
      name: `${emote.icon} ${emote.label}`,
      action: () => {
        if (context && context.component && typeof context.component.insertEmote === 'function') {
          context.component.insertEmote(emote.icon);
        }
      }
    }));

    this.contextMenu.open(pointer, actions, 'エモート選択');
  }
}
