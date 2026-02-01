import { Injectable, OnDestroy, NgZone } from '@angular/core';
import { ChatListenerService } from '../service/chat-listener.service';
import { GameCharacter } from '@udonarium/game-character';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { DataElement } from '@udonarium/data-element';
import {
  DYNAMIC_STAND_SECTION_NAME,
  StandSetting,
  StandGlobalConfig,
  DEFAULT_HEAD_OFFSET,
  DEFAULT_AUTO_X_RATIO,
  NOVEL_MODE_CONSTANTS
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
import { PluginOverlayService, StandingActor } from '../service/plugin-overlay.service';

@Injectable({
  providedIn: 'root'
})
export class DynamicStandPluginService implements OnDestroy {
  readonly PLUGIN_ID = 'dynamic-stand';
  config: StandGlobalConfig = new StandGlobalConfig();
  
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
    private pluginOverlayService: PluginOverlayService,
    private ngZone: NgZone
  ) { }

  ngOnDestroy() {
    if (this.observerSubscription) this.observerSubscription.unsubscribe();
    EventSystem.unregister(this);
  }

  /**
   * 現在のローカルアクターのリストを PluginOverlayService から取得します。
   */
  get localActors(): StandingActor[] {
    return this.pluginOverlayService.localActors;
  }

  /**
   * 現在のローカルアクターのリストを PluginOverlayService に設定します。
   */
  set localActors(actors: StandingActor[]) {
    this.pluginOverlayService.localActors = actors;
  }

  initialize() {
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
      .on('XML_LOADED', () => {
        setTimeout(() => {
          const characters = ObjectStore.instance.getObjects<GameCharacter>(GameCharacter);
          characters.forEach(c => this.ensureStandSetting(c));
        }, 1000);
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
        // 台詞またはエモートが含まれている場合のみキーワードを付与
        const hasSpeech = /[「『].+?[」』]/.test(text);
        const hasEmote = /(\p{Extended_Pictographic}|[！？])/u.test(text);
        if (hasSpeech || hasEmote) {
          return text + ' 💬';
        }
      }
      return text;
    });
  }

  private getOrCreateStageObject(): OverlayObject {
    this.stageObject = ObjectStore.instance.get<OverlayObject>(this.STAGE_ID);
    if (!this.stageObject) {
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
      this.localActors = nextActors;
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

    const textWithoutKeyword = message.text.split('💬').join('').trim();
    
    // 1. テキストの分割（台詞部分と外側部分）
    const speechMatch = textWithoutKeyword.match(/([「『])(.+?)([」』])/);
    const wholeSpeech = speechMatch ? speechMatch[0] : ''; // 括弧を含む台詞全体 「〜」
    const contentSpeech = speechMatch ? speechMatch[2] : ''; // 括弧の中身 〜
    const outsideText = speechMatch ? textWithoutKeyword.replace(wholeSpeech, '') : textWithoutKeyword;

    // 2. エモート（トリガー）の探索
    const emoteRegexAll = /(\p{Extended_Pictographic}|[！？])/u; // 絵文字＋記号
    const emoteRegexPictogram = /\p{Extended_Pictographic}/u;    // 絵文字のみ

    let emoteKeyword = '';
    
    // 優先度A: 外側部分から探す（絵文字＋記号）
    const matchOutside = outsideText.match(emoteRegexAll);
    if (matchOutside) {
      emoteKeyword = matchOutside[0];
    } else {
      // 優先度B: 台詞部分から探す（絵文字のみ！記号は無視）
      if (speechMatch) {
        const matchInside = contentSpeech.match(emoteRegexPictogram);
        if (matchInside) {
          emoteKeyword = matchInside[0];
        }
      } else {
        // 括弧なしの場合は全体から探す（絵文字＋記号）
        const matchWhole = textWithoutKeyword.match(emoteRegexAll);
        if (matchWhole) {
          emoteKeyword = matchWhole[0];
        }
      }
    }

    // 3. 表示テキストの構築
    // トリガーとなったエモートがあれば、元のテキストから削除する
    let processedText = textWithoutKeyword;
    if (emoteKeyword) {
      processedText = processedText.split(emoteKeyword).join('').trim();
    }

    // 削除後のテキストから再度台詞を抽出（あるいは整形）
    // ※エモート削除によって括弧の位置がずれることはない（絵文字は1文字扱い、括弧は消えないため）
    const processedSpeechMatch = processedText.match(/([「『])(.+?)([」』])/);
    const processedContentSpeech = processedSpeechMatch ? processedSpeechMatch[2] : '';
    
    // 吹き出しに表示するエモート（フロート表示用）
    let floatingEmote = '';
    // 最終的な表示テキスト
    let finalSpeechText = '';

    if (processedSpeechMatch) {
      // 台詞がある場合
      const existing = this.localActors.find(a => a.characterId === character.identifier);
      if (existing && existing.expirationTime > Date.now() - 5000) {
        finalSpeechText = existing.speechText + '\n' + processedContentSpeech;
      } else {
        finalSpeechText = processedContentSpeech;
      }
      // エモートが見つかっていればフロート表示
      if (emoteKeyword) floatingEmote = emoteKeyword;

    } else {
      // 台詞がない（括弧なし）場合
      // processedText は既にエモート削除済み
      
      // エモート単体発言だった場合（テキストが空）、エモートをフロート表示
      if (!processedText && emoteKeyword) {
        floatingEmote = emoteKeyword;
      }

      const existing = this.localActors.find(a => a.characterId === character.identifier);
      if (existing && processedText && existing.expirationTime > Date.now() - 5000) {
        finalSpeechText = existing.speechText + '\n' + processedText;
      } else {
        finalSpeechText = processedText;
      }
    }

    // エモート音の再生
    if (emoteKeyword) {
      const emoteData = this.emoteManager.getEmotes().find(e => e.icon === emoteKeyword);
      if (emoteData && emoteData.soundIdentifier) SoundEffect.play(emoteData.soundIdentifier);
    }

    const settings = this.getStandSettings(character);
    let selected = settings.find(s => s.emote === emoteKeyword && s.imageIdentifier) || settings.find(s => s.index === '1') || settings[0];
    if (!selected) {
      selected = { index: 'fallback', emote: '', imageIdentifier: character.imageFile ? character.imageFile.identifier : '', offsetX: 0, offsetY: 0 };
    }

    if (selected.imageIdentifier) {
      this.renderLocalStand(character.identifier, selected, finalSpeechText, floatingEmote);
    }
  }

  private renderLocalStand(characterId: string, setting: StandSetting, speechText: string, floatingEmote: string) {
    this.localActors = this.localActors.filter(a => a.characterId !== characterId);
    const side = (this.localActors.filter(a => a.side === 'left').length <= this.localActors.filter(a => a.side === 'right').length) ? 'left' : 'right';
    
    // --- 1. 立ち絵/アイコンの判定ロジック ---
    let isStand = false;
    if (setting.standType === 'stand') {
      isStand = true;
    } else if (setting.standType === 'icon') {
      isStand = false;
    } else {
      // auto: 縦長(縦横比1.2以上)なら立ち絵、それ以外はアイコン
      const aspect = (setting.imageWidth > 0 && setting.imageHeight > 0) ? (setting.imageHeight / setting.imageWidth) : 0;
      isStand = aspect > NOVEL_MODE_CONSTANTS.ASPECT_RATIO_THRESHOLD;
    }

    // --- 2. 表示パラメータの決定 ---
    // 立ち絵: 高さ100%(config基準), 下揃え(0), カバー表示(トリミング有効)
    // アイコン: 高さ縮小, 浮かせ, コンテイン表示(全体表示)
    const height = isStand ? this.config.standHeight : (this.config.standHeight * NOVEL_MODE_CONSTANTS.ICON_HEIGHT_RATIO);
    const bottom = isStand ? 0 : NOVEL_MODE_CONSTANTS.ICON_BOTTOM_OFFSET;
    const objectFit = isStand ? 'cover' : 'contain';
    
    // フォーカス位置の決定
    let objectPosition = 'center bottom'; // default
    if (isStand) {
      // 立ち絵としてトリミングする場合のみフォーカス位置を適用
      switch (setting.focusPosition) {
        case 'left':   objectPosition = 'left center'; break;
        case 'right':  objectPosition = 'right center'; break;
        case 'top':    objectPosition = 'center top'; break;
        case 'bottom': objectPosition = 'center bottom'; break;
        case 'center': default: objectPosition = 'center center'; break;
      }
    } else {
      // アイコンの場合は下端に吸着させる（浮いているウィンドウに乗っている感）
      objectPosition = 'center bottom';
    }

    // 頭上の高さ計算（吹き出し位置）
    // アイコンの場合も画像表示高さ(height)を基準にする
    const headY = height * (1 - (setting.headOffset ?? DEFAULT_HEAD_OFFSET) / 100) + bottom;
    
    // 型安全なオブジェクト生成
    const actor: StandingActor = {
      characterId: characterId,
      side: side,
      timestamp: Date.now(),
      expirationTime: Date.now() + (speechText.length * this.config.typingSpeed) + this.config.displayDuration + 500,
      imageIdentifier: setting.imageIdentifier,
      width: this.config.standWidth,
      height: height,
      speechText: speechText,
      speechVisible: !!speechText,
      speechOffsetX: (side === 'left') ? (this.config.standWidth * DEFAULT_AUTO_X_RATIO) : -(this.config.standWidth * DEFAULT_AUTO_X_RATIO),
      speechOffsetY: headY + setting.offsetY,
      emoteText: floatingEmote,
      emoteVisible: !!floatingEmote,
      emoteOffsetX: (side === 'left') ? (this.config.standWidth * 0.2) : -(this.config.standWidth * 0.2),
      emoteOffsetY: headY + setting.offsetY + 2,
      opacity: 1.0,
      left: 0,
      isDisappearing: false,
      // 新パラメータ
      objectFit: objectFit,
      objectPosition: objectPosition,
      bottom: bottom
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
      sidePreference: (group.children.find(c => (c as DataElement).name === 'side') as DataElement)?.value as any || 'auto',
      standType: (group.children.find(c => (c as DataElement).name === 'standType') as DataElement)?.value as any || NOVEL_MODE_CONSTANTS.DEFAULT_STAND_TYPE,
      focusPosition: (group.children.find(c => (c as DataElement).name === 'focusPosition') as DataElement)?.value as any || NOVEL_MODE_CONSTANTS.DEFAULT_FOCUS_POSITION
    }));
  }

  private ensureStandSetting(character: GameCharacter) {
    try {
      if (!character) return;
      if (!character.detailDataElement) {
        return;
      }
      const section = character.detailDataElement.children.find(c => c instanceof DataElement && c.name === DYNAMIC_STAND_SECTION_NAME);
      if (!section) this.addStandSetting(character);
      else {
        // 既存データのマイグレーション（新しい項目がなければ追加）
        for (const group of section.children) {
          if (group instanceof DataElement) {
             if (!group.getFirstElementByName('standType')) {
               group.appendChild(DataElement.create('standType', NOVEL_MODE_CONSTANTS.DEFAULT_STAND_TYPE, {}, 'st_' + group.identifier));
             }
             if (!group.getFirstElementByName('focusPosition')) {
               group.appendChild(DataElement.create('focusPosition', NOVEL_MODE_CONSTANTS.DEFAULT_FOCUS_POSITION, {}, 'fp_' + group.identifier));
             }
          }
        }
        this.refreshStandDimensions(character);
      }
    } catch (e) {
    }
  }

  addStandSetting(character: GameCharacter) {
    try {
      if (!character.detailDataElement) {
        if (!character.rootDataElement) {
           return;
        }
        character.rootDataElement.appendChild(DataElement.create('detail', '', {}, 'detail_' + character.identifier));
      }

      let section = character.detailDataElement.children.find(c => c instanceof DataElement && c.name === DYNAMIC_STAND_SECTION_NAME) as DataElement;
      if (!section) {
        section = DataElement.create(DYNAMIC_STAND_SECTION_NAME, '', {}, DYNAMIC_STAND_SECTION_NAME + '_' + character.identifier);
        character.detailDataElement.appendChild(section);
      }
      const indices = section.children.filter((c): c is DataElement => c instanceof DataElement).map(c => parseInt(c.name)).filter(n => !isNaN(n));
      const nextIndex = indices.length > 0 ? Math.max(...indices) + 1 : 1;
      const group = DataElement.create(nextIndex.toString(), '', {}, nextIndex.toString() + '_' + character.identifier);
      group.appendChild(DataElement.create('emote', nextIndex === 1 ? '' : 'エモート名', {}, 'emote_' + group.identifier));
      
      const imageIdElement = character.imageDataElement ? character.imageDataElement.getFirstElementByName('imageIdentifier') : null;
      const imageId = imageIdElement ? imageIdElement.value : '';
      
      group.appendChild(DataElement.create('imageIdentifier', imageId as string, { type: 'imageIdentifier' }, 'img_' + group.identifier));
      group.appendChild(DataElement.create('imageWidth', 0, { type: 'number' }, 'w_' + group.identifier));
      group.appendChild(DataElement.create('imageHeight', 0, { type: 'number' }, 'h_' + group.identifier));
      group.appendChild(DataElement.create('headOffset', DEFAULT_HEAD_OFFSET, { type: 'number' }, 'ho_' + group.identifier));
      group.appendChild(DataElement.create('side', 'auto', {}, 'side_' + group.identifier));
      group.appendChild(DataElement.create('offsetX', 0, { type: 'number' }, 'ox_' + group.identifier));
      group.appendChild(DataElement.create('offsetY', 0, { type: 'number' }, 'oy_' + group.identifier));
      group.appendChild(DataElement.create('standType', NOVEL_MODE_CONSTANTS.DEFAULT_STAND_TYPE, {}, 'st_' + group.identifier));
      group.appendChild(DataElement.create('focusPosition', NOVEL_MODE_CONSTANTS.DEFAULT_FOCUS_POSITION, {}, 'fp_' + group.identifier));
      section.appendChild(group);
      this.refreshStandDimensions(character);
      section.update(); character.detailDataElement.update(); character.update();
    } catch (e) {
    }
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