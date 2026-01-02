import { Injectable, OnDestroy } from '@angular/core';
import { ChatListenerService } from '../service/chat-listener.service';
import { PluginOverlayService } from '../service/plugin-overlay.service';
import { OverlayObject } from '../overlay-object';
import { GameCharacter } from '@udonarium/game-character';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { DataElement } from '@udonarium/data-element';
import { DYNAMIC_STAND_SECTION_NAME, StandSetting, StandGlobalConfig, StandingUnit, StandingCharacter, StandingSpeech, StandingEmote } from './dynamic-stand.model';
import { OverlayEffectsService } from '../service/overlay-effects.service';
import { ChatMessageService } from 'service/chat-message.service';
import { PluginMapperService } from '../service/plugin-mapper.service';
import { PluginDataObserverService } from '../service/plugin-data-observer.service';
import { PluginHelperService } from '../service/plugin-helper.service';
import { PluginDataContainer } from '../../class/plugin-data-container';
import { EventSystem } from '@udonarium/core/system';
import { PeerCursor } from '@udonarium/peer-cursor';
import { EmoteManagerService } from './emote-manager.service';
import { SoundEffect } from '@udonarium/sound-effect';

@Injectable({
  providedIn: 'root'
})
export class DynamicStandPluginService implements OnDestroy {
  readonly PLUGIN_ID = 'dynamic-stand';
  
  // 舞台設定（マスターコントロール）
  config: StandGlobalConfig = new StandGlobalConfig();
  
  // 表示中のテキスト管理 (連投連結用)
  private activeTexts: Map<string, string> = new Map();

  private observerSubscription: { unsubscribe: () => void } = null;
  private currentContainer: PluginDataContainer = null;
  private isSaving = false;
  private isCutInBlocked = false;

  constructor(
    private chatListenerService: ChatListenerService,
    private overlayService: PluginOverlayService,
    private effectsService: OverlayEffectsService,
    private chatMessageService: ChatMessageService,
    private pluginMapper: PluginMapperService,
    private observer: PluginDataObserverService,
    private pluginHelper: PluginHelperService,
    private emoteManager: EmoteManagerService
  ) {}

  ngOnDestroy() {
    if (this.observerSubscription) this.observerSubscription.unsubscribe();
    EventSystem.unregister(this);
  }

  initialize() {
    // カットイン監視 (リアクティブ)
    EventSystem.register(this)
      .on('CUT_IN_PLAYING', event => {
        const isPlaying = !!event.data;
        if (isPlaying) {
          this.isCutInBlocked = true;
          this.forceCleanupAll();
        } else {
          this.isCutInBlocked = false;
        }
      })
      .on('ON_CHARACTER_DATA_ELEMENTS_CREATED', event => {
        const character = event.data.character as GameCharacter;
        if (character) {
          this.ensureStandSetting(character);
        }
      });
    
    // 既存のキャラクターに対して一括チェック
    setTimeout(() => {
      const characters = ObjectStore.instance.getObjects<GameCharacter>(GameCharacter);
      characters.forEach(c => this.ensureStandSetting(c));
    }, 2000); 
    
    // オブジェクト削除時の後処理（テキストクリアと再配置）
    EventSystem.register(this)
      .on('DELETE_GAME_OBJECT', event => {
        const identifier = event.data.identifier;
        // activeTexts に存在するID、または unit_ で始まるラベルを持つオブジェクトが消えたらチェック
        for (const [charId, text] of this.activeTexts.entries()) {
          // ラベル unit_<charId> に一致するオブジェクトが消えたか確認
          // identifier 直接一致は OverlayObject 側で ownerPeerId を見ているため、
          // ここでは全消し後の再配置トリガーとして機能させる
          if (event.data.aliasName === 'overlay-object') {
            // 少し遅らせて再配置（完全にObjectStoreから消えた後）
            setTimeout(() => {
               const units = ObjectStore.instance.getObjects<OverlayObject>(OverlayObject)
                 .filter(obj => obj.type === 'standing-unit');
               const stillExists = units.some(u => u.label === 'unit_' + charId);
               if (!stillExists) {
                 this.activeTexts.delete(charId);
                 this.repositionAll();
               }
            }, 100);
          }
        }
      });

    // 永続化設定の監視
    this.observerSubscription = this.observer.observe(this, this.PLUGIN_ID, '', (container) => {
      if (this.isSaving) return;

      this.currentContainer = container;
      if (container) {
        const loaded = this.pluginMapper.fromElement<StandGlobalConfig>(container.state);
        if (loaded) {
          const currentJson = JSON.stringify(this.config);
          const loadedJson = JSON.stringify(loaded);
          if (currentJson !== loadedJson) {
            Object.assign(this.config, loaded);
            if (!Array.isArray(this.config.activeCharacterIds)) {
              this.config.activeCharacterIds = [];
            }
          }
        }
      } else {
        setTimeout(() => {
          if (!this.currentContainer && !this.isSaving) {
            this.saveConfig();
          }
        }, 1000);
      }
    });

    this.chatListenerService.addRule({
      owner: this,
      name: 'dynamic-stand-trigger',
      keyword: '', 
      callback: (chatMessage) => {
        this.processChatMessage(chatMessage.name, chatMessage.text, chatMessage.from);
      }
    });
  }

  private forceCleanupAll() {
    const objects = ObjectStore.instance.getObjects<OverlayObject>(OverlayObject);
    const toDestroy = objects.filter(obj => 
      obj.type === 'standing-unit' || 
      // 旧方式のゴミ掃除も兼ねる
      (obj.label && (obj.label.startsWith('stand_') || obj.label.startsWith('speech_') || obj.label.startsWith('emote_')))
    );
    
    for (const obj of toDestroy) obj.destroy();
    
    this.activeTexts.clear();
  }

  saveConfig() {
    this.isSaving = true;
    try {
      if (!this.currentContainer) {
        this.currentContainer = this.pluginHelper.getOrCreateContainer(this.PLUGIN_ID, '');
      }
      const element = this.pluginMapper.toElement('state', this.config);
      this.currentContainer.state.children.forEach(child => child.destroy());
      Array.from(element.children).forEach(child => this.currentContainer.state.appendChild(child));
      this.currentContainer.update();
    } finally {
      setTimeout(() => this.isSaving = false, 200);
    }
  }

  toggleActive(characterId: string | null) {
    if (!characterId) return;
    const index = this.config.activeCharacterIds.indexOf(characterId);
    if (index >= 0) {
      this.config.activeCharacterIds.splice(index, 1);
      this.forceCleanup(characterId);
    } else {
      this.config.activeCharacterIds.push(characterId);
    }
    this.saveConfig();
  }

  isActive(characterId: string): boolean {
    return this.config.activeCharacterIds.includes(characterId);
  }

  isAnyActive(): boolean {
    return this.config.activeCharacterIds.length > 0;
  }

  /**
   * 現在のステージ状態（左右の並び順）を解析します。
   * OverlayObject (type='standing-unit') の座標情報から推測します。
   */
  private getStageState(): { left: string[], right: string[] } {
    const objects = ObjectStore.instance.getObjects<OverlayObject>(OverlayObject);
    const units = objects.filter(obj => obj.type === 'standing-unit');
    
    // label = "unit_<charId>"
    const leftUnits = units
      .filter(u => u.left < 50)
      .sort((a, b) => a.left - b.left)
      .map(u => u.label.replace('unit_', ''));
      
    const rightUnits = units
      .filter(u => u.left >= 50)
      .sort((a, b) => b.left - a.left)
      .map(u => u.label.replace('unit_', ''));

    return { left: leftUnits, right: rightUnits };
  }

  private repositionAll() {
    const { left, right } = this.getStageState();
    
    left.forEach((id, index) => this.updateUnitPosition(id, 'left', index));
    right.forEach((id, index) => this.updateUnitPosition(id, 'right', index));
  }

  private updateUnitPosition(characterId: string, side: 'left' | 'right', index: number) {
    const objects = ObjectStore.instance.getObjects<OverlayObject>(OverlayObject);
    const unit = objects.find(obj => obj.type === 'standing-unit' && obj.label === 'unit_' + characterId);

    if (!unit) return;

    // 左側: 端(offset) + index*幅
    // 右側: 100 - 端(offset) - index*幅
    const x = side === 'left' 
      ? (this.config.edgeOffset + index * this.config.slideWidth) 
      : (100 - this.config.edgeOffset - index * this.config.slideWidth);
    
    unit.transitionDuration = this.config.animationDuration;
    unit.transitionEasing = 'ease-out';
    unit.left = x;
    
    // ユニット内のside情報も更新（吹き出しの向き用）
    // NOTE: DataElementを直接操作して更新する
    const content = unit.content;
    const sideElm = content.children.find(c => c instanceof DataElement && c.name === 'side') as DataElement;
    if (sideElm && sideElm.value !== side) {
      sideElm.value = side;
    }

    unit.update();
  }

  private forceCleanup(characterId: string) {
    const objects = ObjectStore.instance.getObjects<OverlayObject>(OverlayObject);
    const unit = objects.find(obj => obj.label === 'unit_' + characterId);
    
    if (unit) {
      unit.destroy();
    }

    this.activeTexts.delete(characterId);
    
    // 消えたら位置を再調整
    setTimeout(() => this.repositionAll(), 200);
  }

  private processChatMessage(senderName: string, text: string, senderId: string) {
    if (this.isCutInBlocked) return;

    // 1. 発言者を特定
    const characters = ObjectStore.instance.getObjects<GameCharacter>(GameCharacter);
    let character = characters.find(c => c.identifier === senderId) || characters.find(c => c.name === senderName);
    
    if (!character || !this.isActive(character.identifier)) return;

    // 2. 鍵括弧内のセリフ抽出
    const speechMatch = text.match(/[「『](.+?)[」』]/);
    const speechText = speechMatch ? speechMatch[1] : '';

    // 3. 連結処理
    let finalSpeechText = speechText;
    if (speechText) {
      const existingText = this.activeTexts.get(character.identifier);
      const objects = ObjectStore.instance.getObjects<OverlayObject>(OverlayObject);
      const unit = objects.find(obj => obj.type === 'standing-unit' && obj.label === 'unit_' + character.identifier);
      
      // ユニットが存在し、かつ不透明度があり、かつ有効期限に1秒以上の余裕がある場合のみ連結
      if (existingText && unit && unit.opacity > 0.5 && unit.expirationTime > Date.now() + 1000) {
        finalSpeechText = existingText + '\n' + speechText;
      } else {
        // それ以外（消えかかっている、または存在しない）は新規として扱う
        this.activeTexts.delete(character.identifier);
        finalSpeechText = speechText;
      }
      this.activeTexts.set(character.identifier, finalSpeechText);
    }

    // 4. エモート抽出
    const emoteRegex = /(\p{Extended_Pictographic}|[!?！？])/u;
    const emoteMatch = text.match(emoteRegex);
    const emoteKeyword = emoteMatch ? emoteMatch[0] : '';

    // SE再生
    if (emoteKeyword) {
      const emoteData = this.emoteManager.getEmotes().find(e => e.icon === emoteKeyword);
      if (emoteData && emoteData.soundIdentifier) {
        SoundEffect.play(emoteData.soundIdentifier);
      }
    }

    // セリフからエモート文字を除去
    if (finalSpeechText && emoteKeyword) {
      finalSpeechText = finalSpeechText.split(emoteKeyword).join('').trim();
    }

    if (!finalSpeechText && !emoteKeyword) return;

    // 5. 設定読み込みと選択
    const settings = this.getStandSettings(character);
    let selected = null;
    let floatingEmote = '';

    if (emoteKeyword) {
      selected = settings.find(s => s.emote === emoteKeyword && s.imageIdentifier);
    }
    if (!selected) {
      selected = settings.find(s => s.index === '1') || settings[0];
      floatingEmote = emoteKeyword;
    }

    if (!selected) return;

    this.renderStand(character.identifier, selected, finalSpeechText, floatingEmote);
  }

  private getStandSettings(character: GameCharacter): StandSetting[] {
    const section = character.detailDataElement.children.find(
      c => c instanceof DataElement && c.name === DYNAMIC_STAND_SECTION_NAME
    ) as DataElement;

    if (!section) return [];

    const settings: StandSetting[] = [];
    for (const group of section.children) {
      if (!(group instanceof DataElement)) continue;
      
      const emoteElm = group.children.find(c => c instanceof DataElement && c.name === 'emote') as DataElement;
      const imgElm = group.children.find(c => c instanceof DataElement && c.name === 'imageIdentifier') as DataElement;
      const oxElm = group.children.find(c => c instanceof DataElement && c.name === 'offsetX') as DataElement;
      const oyElm = group.children.find(c => c instanceof DataElement && c.name === 'offsetY') as DataElement;
      const sideElm = group.children.find(c => c instanceof DataElement && c.name === 'side') as DataElement;

      settings.push({
        index: group.name,
        emote: emoteElm ? emoteElm.value as string : '',
        imageIdentifier: imgElm ? imgElm.value as string : '',
        offsetX: oxElm ? Number(oxElm.value) : 0,
        offsetY: oyElm ? Number(oyElm.value) : 0,
        sidePreference: (sideElm ? sideElm.value as any : 'auto')
      });
    }
    return settings;
  }

  addStandSetting(character: GameCharacter) {
    let section = character.detailDataElement.children.find(
      c => c instanceof DataElement && c.name === DYNAMIC_STAND_SECTION_NAME
    ) as DataElement;

    if (!section) {
      section = DataElement.create(DYNAMIC_STAND_SECTION_NAME, '', {}, DYNAMIC_STAND_SECTION_NAME + '_' + character.identifier);
      character.detailDataElement.appendChild(section);
    }

    const indices = section.children
      .filter((c): c is DataElement => c instanceof DataElement)
      .map(c => parseInt(c.name))
      .filter(n => !isNaN(n));
    const nextIndex = indices.length > 0 ? Math.max(...indices) + 1 : 1;

    const group = DataElement.create(nextIndex.toString(), '', {}, nextIndex.toString() + '_' + character.identifier);
    group.appendChild(DataElement.create('emote', nextIndex === 1 ? '' : 'エモート名', {}, 'emote_' + group.identifier));
    group.appendChild(DataElement.create('imageIdentifier', character.imageFile.identifier, { type: 'imageIdentifier' }, 'img_' + group.identifier));
    group.appendChild(DataElement.create('side', 'auto', {}, 'side_' + group.identifier));
    group.appendChild(DataElement.create('offsetX', 20, { type: 'number' }, 'ox_' + group.identifier));
    group.appendChild(DataElement.create('offsetY', -20, { type: 'number' }, 'oy_' + group.identifier));

    section.appendChild(group);
    
    section.update();
    character.detailDataElement.update();
    character.update();
  }
  
  private ensureStandSetting(character: GameCharacter) {
    const section = character.detailDataElement.children.find(
      c => c instanceof DataElement && c.name === DYNAMIC_STAND_SECTION_NAME
    );
    if (!section) {
      this.addStandSetting(character);
    }
  }

  /**
   * 統合オブジェクト (StandingUnit) をレンダリングします。
   */
  private renderStand(characterId: string, setting: StandSetting, speechText: string, floatingEmote: string = '') {
    const { left, right } = this.getStageState();
    
    // 1. サイド決定
    let side: 'left' | 'right';
    if (left.includes(characterId)) side = 'left';
    else if (right.includes(characterId)) side = 'right';
    else {
      const pref = setting.sidePreference || 'auto';
      if (pref === 'left') side = 'left';
      else if (pref === 'right') side = 'right';
      else side = (left.length <= right.length) ? 'left' : 'right';
    }

    // 2. 他キャラの押し出し
    const currentStage = side === 'left' ? left : right;
    const others = currentStage.filter(id => id !== characterId);
    others.forEach((id, idx) => {
      this.updateUnitPosition(id, side, idx + 1); // 1つ奥へ
    });

    const x = side === 'left' ? this.config.edgeOffset : (100 - this.config.edgeOffset);
    const objects = ObjectStore.instance.getObjects<OverlayObject>(OverlayObject);
    let unit = objects.find(obj => obj.type === 'standing-unit' && obj.label === 'unit_' + characterId);

    // ゾンビ化ガード: 既存ユニットが透明すぎる、または有効期限が切れそう（残り1秒未満）な場合は一度消して作り直す
    // これにより、退場アニメーション(500ms)との競合を完全に回避する
    if (unit && (unit.opacity < 0.1 || (unit.expirationTime > 0 && unit.expirationTime < Date.now() + 1000))) {
      unit.destroy();
      unit = null;
    }

    const wasOnOtherSide = (side === 'left' && right.includes(characterId)) || (side === 'right' && left.includes(characterId));

    // --- StandingUnit モデルの構築 ---
    const unitData = new StandingUnit();
    unitData.characterId = characterId;
    unitData.side = side;
    
    // Character data
    unitData.character.imageIdentifier = setting.imageIdentifier;
    unitData.character.scaleX = side === 'left' ? 1.0 : -1.0;
    unitData.character.width = this.config.standWidth;
    unitData.character.height = this.config.standHeight;

    // Speech data
    unitData.speech.text = speechText;
    unitData.speech.isVisible = !!speechText;
    unitData.speech.typingSpeed = this.config.typingSpeed;
    unitData.speech.offsetX = setting.offsetX; // ※CSSで相対配置するが、微調整値として持たせておく
    unitData.speech.offsetY = setting.offsetY;

    // Emote data
    unitData.emote.text = floatingEmote;
    unitData.emote.isVisible = !!floatingEmote;
    unitData.emote.scale = this.config.emoteSize;

    // --- OverlayObject の生成または更新 ---
    if (!unit) {
      unit = this.overlayService.createOverlay('standing-unit');
      unit.label = 'unit_' + characterId;
      if (PeerCursor.myCursor) unit.ownerPeerId = PeerCursor.myCursor.peerId;
      unit.isClickToClose = false;
      unit.anchor = 'bottom';
      
      // 初期位置（画面外）
      unit.left = side === 'left' ? -this.config.standWidth : 100 + this.config.standWidth;
      unit.top = 100;
      unit.width = this.config.standWidth;
      unit.height = this.config.standHeight;
      unit.opacity = 0;
      unit.transitionDuration = 0;
      
      // モデルをDataElementに変換してセット
      const element = this.pluginMapper.toElement('content', unitData);
      unit.content.children.forEach(c => c.destroy()); // クリア
      Array.from(element.children).forEach(c => unit.content.appendChild(c));
      
      unit.update();

      // 入場アニメーション
      setTimeout(() => {
        if (!unit) return;
        unit.transitionDuration = 800;
        unit.transitionEasing = 'cubic-bezier(0.22, 1, 0.36, 1)';
        unit.left = x;
        unit.opacity = 1.0;
        unit.update();
      }, 50);

    } else {
      // 既存更新
      unit.transitionDuration = this.config.animationDuration;
      unit.transitionEasing = 'ease-out';
      unit.left = x;
      unit.opacity = 1.0;
      unit.width = this.config.standWidth;
      unit.height = this.config.standHeight;

      // モデルをDataElementに変換してセット
      const element = this.pluginMapper.toElement('content', unitData);
      // 効率化: 変更点だけDiff更新するのが理想だが、PluginMapperは全置換が基本なので
      // 一旦全置換する (OverlayObjectのupdate頻度としては許容範囲)
      unit.content.children.forEach(c => c.destroy());
      Array.from(element.children).forEach(c => unit.content.appendChild(c));
      
      unit.update();
    }

    // --- 有効期限の計算とセット ---
    // タイピング時間 + 基本表示時間 + 退場バッファ(500ms)
    const typingDuration = speechText.length * this.config.typingSpeed;
    const totalDuration = typingDuration + this.config.displayDuration + 500;
    
    unit.expirationTime = Date.now() + totalDuration;
    unit.update();

    if (wasOnOtherSide) {
      setTimeout(() => this.repositionAll(), 100);
    }
  }
}

