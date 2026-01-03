import { Injectable, OnDestroy, NgZone } from '@angular/core';
import { ChatListenerService } from '../service/chat-listener.service';
import { GameCharacter } from '@udonarium/game-character';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { DataElement } from '@udonarium/data-element';
import {
  DYNAMIC_STAND_SECTION_NAME,
  StandSetting,
  StandGlobalConfig,
  StandingUnit,
  DEFAULT_HEAD_OFFSET,
  DEFAULT_AUTO_X_RATIO
} from './dynamic-stand.model';
import { ChatMessage } from '@udonarium/chat-message';
import { ImageStorage } from '@udonarium/core/file-storage/image-storage';
import { EmoteManagerService } from './emote-manager.service';
import { SoundEffect } from '@udonarium/sound-effect';
import { PluginDataObserverService } from '../service/plugin-data-observer.service';
import { PluginHelperService } from '../service/plugin-helper.service';
import { PluginMapperService } from '../service/plugin-mapper.service';
import { PluginDataContainer } from '../../class/plugin-data-container';
import { OverlayObject } from '../overlay-object';
import { PeerCursor } from '@udonarium/peer-cursor';
import { EventSystem } from '@udonarium/core/system';
import { UIExtensionService } from '../service/ui-extension.service';

@Injectable({
  providedIn: 'root'
})
export class DynamicStandPluginService implements OnDestroy {
  readonly PLUGIN_ID = 'dynamic-stand';
  config: StandGlobalConfig = new StandGlobalConfig();
  
  localActors: any[] = [];
  
  private stageObject: OverlayObject = null;
  private readonly STAGE_ID = 'DYNAMIC_STAND_STAGE_GLOBAL';
  private readonly STAGE_LABEL = 'GLOBAL_STANDING_STAGE';

  private localActiveCharacterIds: Set<string> = new Set();
  private observerSubscription: { unsubscribe: () => void } = null;
  private currentContainer: PluginDataContainer = null;
  private isSaving = false;
  private isCutInBlocked = false;

  constructor(
    private chatListenerService: ChatListenerService,
    private emoteManager: EmoteManagerService,
    private observer: PluginDataObserverService,
    private pluginHelper: PluginHelperService,
    private pluginMapper: PluginMapperService,
    private uiExtensionService: UIExtensionService,
    private ngZone: NgZone
  ) {
    console.log(`[DynamicStand] Service Constructed. Instance: ${Math.random().toString(36).substr(2, 5)}`);
  }

  ngOnDestroy() {
    if (this.observerSubscription) this.observerSubscription.unsubscribe();
    EventSystem.unregister(this);
  }

  initialize() {
    console.log(`[DynamicStand] Initializing (Keyword-Driven Mode)...`);
    setTimeout(() => this.getOrCreateStageObject(), 1000);
    
    // 頻度を上げてチェックの漏れを防ぐ
    setInterval(() => {
      this.ngZone.run(() => this.cleanupExpiredActors());
    }, 500);

    EventSystem.register(this)
      .on('ADD_GAME_OBJECT', event => {
        if (event.data.aliasName === 'character') {
          const character = ObjectStore.instance.get<GameCharacter>(event.data.identifier);
          if (character) this.ensureStandSetting(character);
        }
      })
      .on('CUT_IN_PLAYING', event => {
        if (event.data) { this.isCutInBlocked = true; this.localActors = []; } 
        else { this.isCutInBlocked = false; }
      });
    
    setTimeout(() => {
      const characters = ObjectStore.instance.getObjects<GameCharacter>(GameCharacter);
      characters.forEach(c => this.ensureStandSetting(c));
    }, 3000); 

    this.observerSubscription = this.observer.observe(this, this.PLUGIN_ID, '', (container) => {
      if (this.isSaving) return;
      this.currentContainer = container;
      if (container) {
        const loaded = this.pluginMapper.fromElement<StandGlobalConfig>(container.state);
        if (loaded) Object.assign(this.config, loaded);
      }
    });

    this.chatListenerService.addRule({
      owner: this,
      name: 'dynamic-stand-trigger',
      keyword: '', 
      callback: (chatMessage) => {
        this.ngZone.run(() => this.processChatMessage(chatMessage));
      }
    });

    // 送信前フィルターの登録（立ち絵キーワードの自動付与）
    this.uiExtensionService.registerFilter('chat-send', (text: string, context: any) => {
      if (context instanceof GameCharacter && this.isActive(context)) {
        return text + ' 💬';
      }
      return text;
    });
  }

  private getOrCreateStageObject(): OverlayObject {
    this.stageObject = ObjectStore.instance.get<OverlayObject>(this.STAGE_ID);
    if (!this.stageObject) {
      console.log(`[DynamicStand] Creating Stage Object...`);
      this.stageObject = new OverlayObject(this.STAGE_ID);
      this.stageObject.initialize();
      this.stageObject.type = 'standing-stage';
      this.stageObject.label = this.STAGE_LABEL;
      ObjectStore.instance.add(this.stageObject);
    }
    if (this.stageObject.left !== 0) {
      this.stageObject.left = 0; this.stageObject.top = 100; this.stageObject.width = 100; this.stageObject.height = 100;
      this.stageObject.anchor = 'bottom-left'; this.stageObject.opacity = 1.0;
      this.stageObject.update();
    }
    return this.stageObject;
  }

  private cleanupExpiredActors() {
    const now = Date.now();
    const prevCount = this.localActors.length;
    let changed = false;

    for (const actor of this.localActors) {
      const timeLeft = actor.expirationTime - now;
      
      // 1. 退場アニメーションの開始判定
      if (timeLeft <= 600 && !actor.isDisappearing) {
        actor.isDisappearing = true;
        changed = true;
      }
    }

    // 2. 物理削除の判定
    const nextActors = this.localActors.filter(a => {
      const timeLeft = a.expirationTime - now;
      if (timeLeft > 0) return true;
      if (a.isDisappearing && timeLeft > -600) return true;
      return false;
    });
    
    if (nextActors.length !== prevCount || changed) {
      this.localActors = nextActors; // リスト更新
      this.repositionAll();
    }
  }

  private repositionAll() {
    // 退場中のアクターは位置計算から除外する（現在の位置で去らせるため）
    const activeActors = this.localActors.filter(a => !a.isDisappearing);
    
    // タイムスタンプの降順（新しい順）にソート
    const sortedActors = [...activeActors].sort((a, b) => b.timestamp - a.timestamp);
    const leftActors = sortedActors.filter(a => a.side === 'left');
    const rightActors = sortedActors.filter(a => a.side === 'right');

    leftActors.forEach((a, idx) => {
      a.left = this.config.edgeOffset + (idx * this.config.slideWidth);
    });
    rightActors.forEach((a, idx) => {
      a.left = 100 - this.config.edgeOffset - this.config.standWidth - (idx * this.config.slideWidth);
    });
  }


  

  private processChatMessage(message: ChatMessage) {
    if (this.isCutInBlocked) return;

    // キーワードチェック（手動打ちに対応）
    if (!message.text.includes('💬')) return;

    const characters = ObjectStore.instance.getObjects<GameCharacter>(GameCharacter);
    let character = characters.find(c => c.name === message.name) || characters.find(c => message.name.startsWith(c.name));
    
    // 自分の発言の時だけ、ボタンがONかどうかを厳密にチェックする
    if (message.isSendFromSelf) {
      if (!character || !this.isActive(character)) {
        return;
      }
    }

    if (!character) return;

    console.log(`[DynamicStand] Trigger Detected from ${message.name}! Text: ${message.text}`);

    const textWithoutKeyword = message.text.split('💬').join('').trim();
    const speechMatch = textWithoutKeyword.match(/[「『](.+?)[」』]/);
    const speechText = speechMatch ? speechMatch[1] : '';

    let finalSpeechText = speechText;
    const existing = this.localActors.find(a => a.characterId === character.identifier);
    if (existing && speechText && existing.expirationTime > Date.now() - 5000) {
      finalSpeechText = existing.speechText + '\n' + speechText;
    }

    const emoteRegex = /(\p{Extended_Pictographic}|[!?！？])/u;
    const emoteMatch = textWithoutKeyword.match(emoteRegex);
    const emoteKeyword = emoteMatch ? emoteMatch[0] : '';

    if (emoteKeyword) {
      const emoteData = this.emoteManager.getEmotes().find(e => e.icon === emoteKeyword);
      if (emoteData && emoteData.soundIdentifier) SoundEffect.play(emoteData.soundIdentifier);
    }
    const filteredSpeech = (finalSpeechText && emoteKeyword) ? finalSpeechText.split(emoteKeyword).join('').trim() : finalSpeechText;

    const settings = this.getStandSettings(character);
    let selected = settings.find(s => s.emote === emoteKeyword && s.imageIdentifier) || settings.find(s => s.index === '1') || settings[0];
    if (!selected) {
      selected = { index: 'fallback', emote: '', imageIdentifier: character.imageFile ? character.imageFile.identifier : '', offsetX: 0, offsetY: 0 };
    }

    if (selected.imageIdentifier) {
      console.log(`[DynamicStand] Rendering Actor locally: ${character.name}`);
      this.renderLocalStand(character.identifier, selected, filteredSpeech, (selected.emote === emoteKeyword) ? '' : emoteKeyword);
    }
  }

  private renderLocalStand(characterId: string, setting: StandSetting, speechText: string, floatingEmote: string) {
    this.localActors = this.localActors.filter(a => a.characterId !== characterId);
    const side = (this.localActors.filter(a => a.side === 'left').length <= this.localActors.filter(a => a.side === 'right').length) ? 'left' : 'right';
    const headY = this.config.standHeight * (1 - (setting.headOffset ?? DEFAULT_HEAD_OFFSET) / 100);
    
    const actor = {
      characterId: characterId,
      side: side,
      timestamp: Date.now(),
      expirationTime: Date.now() + (speechText.length * this.config.typingSpeed) + this.config.displayDuration + 500,
      imageIdentifier: setting.imageIdentifier,
      width: this.config.standWidth,
      height: this.config.standHeight,
      speechText: speechText,
      speechVisible: !!speechText,
      speechOffsetX: (side === 'left') ? (this.config.standWidth * DEFAULT_AUTO_X_RATIO) : -(this.config.standWidth * DEFAULT_AUTO_X_RATIO),
      speechOffsetY: headY + setting.offsetY,
      emoteText: floatingEmote,
      emoteVisible: !!floatingEmote,
      emoteOffsetX: (side === 'left') ? (this.config.standWidth * 0.2) : -(this.config.standWidth * 0.2),
      emoteOffsetY: headY + setting.offsetY + 2,
      opacity: 1.0,
      left: 0 
    };

    this.localActors = [...this.localActors, actor];
    this.repositionAll();
  }

  private getStandSettings(character: GameCharacter): StandSetting[] {
    const section = character.detailDataElement.children.find(c => c instanceof DataElement && c.name === DYNAMIC_STAND_SECTION_NAME) as DataElement;
    if (!section) return [];
    return section.children.filter((group): group is DataElement => group instanceof DataElement).map(group => ({
      index: group.name,
      emote: (group.children.find(c => (c as DataElement).name === 'emote') as DataElement)?.value as string || '',
      imageIdentifier: (group.children.find(c => (c as DataElement).name === 'imageIdentifier') as DataElement)?.value as string || '',
      imageWidth: Number((group.children.find(c => (c as DataElement).name === 'imageWidth') as DataElement)?.value) || 0,
      imageHeight: Number((group.children.find(c => (c as DataElement).name === 'imageHeight') as DataElement)?.value) || 0,
      headOffset: Number((group.children.find(c => (c as DataElement).name === 'headOffset') as DataElement)?.value) || DEFAULT_HEAD_OFFSET,
      offsetX: Number((group.children.find(c => (c as DataElement).name === 'offsetX') as DataElement)?.value) || 0,
      offsetY: Number((group.children.find(c => (c as DataElement).name === 'offsetY') as DataElement)?.value) || 0,
      sidePreference: (group.children.find(c => (c as DataElement).name === 'side') as DataElement)?.value as any || 'auto'
    }));
  }

  private ensureStandSetting(character: GameCharacter) {
    const section = character.detailDataElement.children.find(c => c instanceof DataElement && c.name === DYNAMIC_STAND_SECTION_NAME);
    if (!section) this.addStandSetting(character);
    else this.refreshStandDimensions(character);
  }

  addStandSetting(character: GameCharacter) {
    let section = character.detailDataElement.children.find(c => c instanceof DataElement && c.name === DYNAMIC_STAND_SECTION_NAME) as DataElement;
    if (!section) {
      section = DataElement.create(DYNAMIC_STAND_SECTION_NAME, '', {}, DYNAMIC_STAND_SECTION_NAME + '_' + character.identifier);
      character.detailDataElement.appendChild(section);
    }
    const indices = section.children.filter((c): c is DataElement => c instanceof DataElement).map(c => parseInt(c.name)).filter(n => !isNaN(n));
    const nextIndex = indices.length > 0 ? Math.max(...indices) + 1 : 1;
    const group = DataElement.create(nextIndex.toString(), '', {}, nextIndex.toString() + '_' + character.identifier);
    group.appendChild(DataElement.create('emote', nextIndex === 1 ? '' : 'エモート名', {}, 'emote_' + group.identifier));
    group.appendChild(DataElement.create('imageIdentifier', character.imageFile ? character.imageFile.identifier : '', { type: 'imageIdentifier' }, 'img_' + group.identifier));
    group.appendChild(DataElement.create('imageWidth', 0, { type: 'number' }, 'w_' + group.identifier));
    group.appendChild(DataElement.create('imageHeight', 0, { type: 'number' }, 'h_' + group.identifier));
    group.appendChild(DataElement.create('headOffset', DEFAULT_HEAD_OFFSET, { type: 'number' }, 'ho_' + group.identifier));
    group.appendChild(DataElement.create('side', 'auto', {}, 'side_' + group.identifier));
    group.appendChild(DataElement.create('offsetX', 0, { type: 'number' }, 'ox_' + group.identifier));
    group.appendChild(DataElement.create('offsetY', 0, { type: 'number' }, 'oy_' + group.identifier));
    section.appendChild(group);
    this.refreshStandDimensions(character);
    section.update(); character.detailDataElement.update(); character.update();
  }

  private refreshStandDimensions(character: GameCharacter) {
    const section = character.detailDataElement.children.find(c => c instanceof DataElement && c.name === DYNAMIC_STAND_SECTION_NAME) as DataElement;
    if (!section) return;
    for (const group of section.children) {
      if (!(group instanceof DataElement)) continue;
      const imgIdElm = group.children.find(c => (c as DataElement).name === 'imageIdentifier') as DataElement;
      const wElm = group.children.find(c => (c as DataElement).name === 'imageWidth') as DataElement;
      if (imgIdElm && wElm && Number(wElm.value) === 0) {
        const file = ImageStorage.instance.get(imgIdElm.value as string);
        if (file && !file.isEmpty) {
          const img = new Image();
          img.onload = () => {
            wElm.value = img.naturalWidth;
            const hElm = group.children.find(c => (c as DataElement).name === 'imageHeight') as DataElement;
            if (hElm) hElm.value = img.naturalHeight;
            section.update(); character.update();
          };
          img.src = file.url;
        }
      }
    }
  }

  saveConfig() {
    this.isSaving = true;
    try {
      if (!this.currentContainer) this.currentContainer = this.pluginHelper.getOrCreateContainer(this.PLUGIN_ID, '');
      const element = this.pluginMapper.toElement('state', this.config);
      this.currentContainer.state.children.forEach(child => child.destroy());
      Array.from(element.children).forEach(child => this.currentContainer.state.appendChild(child));
      this.currentContainer.update();
    } finally { setTimeout(() => this.isSaving = false, 200); }
  }

  toggleActive(character: GameCharacter) {
    if (!character) return;
    const id = character.identifier;
    if (this.localActiveCharacterIds.has(id)) {
      this.localActiveCharacterIds.delete(id);
    } else {
      this.localActiveCharacterIds.add(id);
    }
  }

  isActive(character: GameCharacter): boolean {
    return character ? this.localActiveCharacterIds.has(character.identifier) : false;
  }
}
