import { Injectable, OnDestroy } from '@angular/core';
import { ChatListenerService } from '../service/chat-listener.service';
import { PluginOverlayService } from '../service/plugin-overlay.service';
import { OverlayObject } from '../overlay-object';
import { GameCharacter } from '@udonarium/game-character';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { DataElement } from '@udonarium/data-element';
import { DYNAMIC_STAND_SECTION_NAME, StandSetting, StandGlobalConfig } from './dynamic-stand.model';
import { OverlayEffectsService } from '../service/overlay-effects.service';
import { ChatMessageService } from 'service/chat-message.service';
import { StandingRendererComponent } from './standing-renderer.component';
import { PluginMapperService } from '../service/plugin-mapper.service';
import { PluginDataObserverService } from '../service/plugin-data-observer.service';
import { PluginHelperService } from '../service/plugin-helper.service';
import { PluginDataContainer } from '../../class/plugin-data-container';

@Injectable({
  providedIn: 'root'
})
export class DynamicStandPluginService implements OnDestroy {
  readonly PLUGIN_ID = 'dynamic-stand';
  
  // 舞台設定（マスターコントロール）
  config: StandGlobalConfig = new StandGlobalConfig();
  
  // ステージ上のキャラクター管理 (0番目が一番端)
  private leftStage: string[] = [];
  private rightStage: string[] = [];

  private observerSubscription: { unsubscribe: () => void } = null;
  private currentContainer: PluginDataContainer = null;
  private isSaving = false;

  constructor(
    private chatListenerService: ChatListenerService,
    private overlayService: PluginOverlayService,
    private effectsService: OverlayEffectsService,
    private chatMessageService: ChatMessageService,
    private pluginMapper: PluginMapperService,
    private observer: PluginDataObserverService,
    private pluginHelper: PluginHelperService
  ) {}

  ngOnDestroy() {
    if (this.observerSubscription) this.observerSubscription.unsubscribe();
  }

  initialize() {
    console.log('[DynamicStand] Service Initializing...');
    
    // 永続化設定の監視
    this.observerSubscription = this.observer.observe(this, this.PLUGIN_ID, '', (container) => {
      // 自分が保存中のイベントは無視する
      if (this.isSaving) return;

      this.currentContainer = container;
      if (container) {
        const loaded = this.pluginMapper.fromElement<StandGlobalConfig>(container.state);
        if (loaded) {
          // 変更がある場合のみ適用（ログの氾濫を防ぐ）
          const currentJson = JSON.stringify(this.config);
          const loadedJson = JSON.stringify(loaded);
          if (currentJson !== loadedJson) {
            console.log('[DynamicStand] Applying Remote Config Change');
            Object.assign(this.config, loaded);
            if (!Array.isArray(this.config.activeCharacterIds)) {
              this.config.activeCharacterIds = [];
            }
          }
        }
      } else {
        // コンテナがない場合は作成を試みる（初回のみ）
        setTimeout(() => {
          if (!this.currentContainer && !this.isSaving) {
            this.saveConfig();
          }
        }, 1000);
      }
    });

    // カスタムレンダラーの登録を強化
    this.overlayService.registerRenderer('speech', StandingRendererComponent);
    this.overlayService.registerRenderer('emote', StandingRendererComponent);

    this.chatListenerService.addRule({
      owner: this,
      name: 'dynamic-stand-trigger',
      keyword: '', 
      callback: (chatMessage) => {
        this.processChatMessage(chatMessage.name, chatMessage.text);
      }
    });
  }

  /**
   * 現在の config を PluginDataContainer に保存/同期します。
   */
  saveConfig() {
    this.isSaving = true;
    try {
      if (!this.currentContainer) {
        this.currentContainer = this.pluginHelper.getOrCreateContainer(this.PLUGIN_ID, '');
      }

      const element = this.pluginMapper.toElement('state', this.config);
      
      // state DataElement の中身を更新
      this.currentContainer.state.children.forEach(child => child.destroy());
      
      const children = Array.from(element.children);
      for (const child of children) {
        this.currentContainer.state.appendChild(child);
      }
      
      this.currentContainer.update();
    } finally {
      // 同期イベントが落ち着くまで少し待ってからフラグを下ろす
      setTimeout(() => this.isSaving = false, 200);
    }
  }

  toggleActive(characterId: string | null) {
    if (!characterId) return;

    const index = this.config.activeCharacterIds.indexOf(characterId);
    if (index >= 0) {
      this.config.activeCharacterIds.splice(index, 1);
      // OFFにしたら即座に画面から消し、ステージから除外
      this.removeFromStage(characterId);
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

  private removeFromStage(characterId: string) {
    let changed = false;
    if (this.leftStage.includes(characterId)) {
      this.leftStage = this.leftStage.filter(id => id !== characterId);
      changed = true;
    } else if (this.rightStage.includes(characterId)) {
      this.rightStage = this.rightStage.filter(id => id !== characterId);
      changed = true;
    }

    if (changed) {
      // 残ったメンバーの位置を再計算（引き寄せ）
      this.repositionAll();
    }
  }

  private repositionAll() {
    this.leftStage.forEach((id, index) => this.updateObjectPosition(id, 'left', index));
    this.rightStage.forEach((id, index) => this.updateObjectPosition(id, 'right', index));
  }

  private updateObjectPosition(characterId: string, side: 'left' | 'right', index: number) {
    const objects = ObjectStore.instance.getObjects<OverlayObject>(OverlayObject);
    const stand = objects.find(obj => obj.type === 'image' && obj.label === 'stand_' + characterId);
    const speech = objects.find(obj => obj.type === 'speech' && obj.label === 'speech_' + characterId);
    const emote = objects.find(obj => obj.type === 'emote' && obj.label === 'emote_' + characterId);

    const x = side === 'left' ? (this.config.edgeOffset + index * this.config.slideWidth) : (100 - this.config.edgeOffset - index * this.config.slideWidth);
    const duration = this.config.animationDuration;
    const easing = 'ease-out';

    if (stand) {
      stand.transitionDuration = duration;
      stand.transitionEasing = easing;
      stand.left = x;
      stand.update();
    }

    if (speech) {
      speech.transitionDuration = duration;
      speech.transitionEasing = easing;
      const lastOffsetX = speech['lastOffsetX'] || 0;
      // 右側ならオフセットを反転させる
      speech.left = x + (side === 'left' ? lastOffsetX : -lastOffsetX);
      speech.update();
    }
    if (emote) {
      emote.transitionDuration = duration;
      emote.transitionEasing = easing;
      emote.left = x;
      emote.update();
    }
  }

  private forceCleanup(characterId: string) {
    const objects = ObjectStore.instance.getObjects<OverlayObject>(OverlayObject);
    const toDestroy = objects.filter(obj => obj.label === 'stand_' + characterId || obj.label === 'speech_' + characterId);
    for (const obj of toDestroy) obj.destroy();
    if (this.cleanupTimers.has(characterId)) {
      clearTimeout(this.cleanupTimers.get(characterId));
      this.cleanupTimers.delete(characterId);
    }
  }

  private processChatMessage(senderName: string, text: string) {
    console.log('[DynamicStand] Chat Received:', senderName, 'text:', text);

    // 1. 発言者名から GameCharacter を特定
    const characters = ObjectStore.instance.getObjects<GameCharacter>(GameCharacter);
    const character = characters.find(c => c.name === senderName);
    
    if (!character) {
      console.warn('[DynamicStand] Character not found for name:', senderName);
      return;
    }

    // 立ち絵 ON のキャラのみ処理
    if (!this.isActive(character.identifier)) {
      console.log('[DynamicStand] Character is not ON. Skipping stand rendering.');
      return;
    }

    // 2. 鍵括弧内のセリフを抽出 (最優先)
    const speechMatch = text.match(/[「『](.+?)[」』]/);
    const speechText = speechMatch ? speechMatch[1] : '';
    console.log('[DynamicStand] Speech text:', speechText || '(none)');

    // 3. テキストからエモート（絵文字・記号）を抽出
    // メッセージ全体から最初の1つをエモートとして採用
    const emoteRegex = /(\p{Extended_Pictographic}|[!?！？])/u;
    const emoteMatch = text.match(emoteRegex);
    const emoteKeyword = emoteMatch ? emoteMatch[0] : '';
    console.log('[DynamicStand] Emote keyword:', emoteKeyword || '(none)');

    if (!speechText && !emoteKeyword) {
      console.log('[DynamicStand] No speech or emote found. Skipping.');
      return;
    }

    // 4. キャラクターから設定を読み取る
    const settings = this.getStandSettings(character);
    
    // 5. 演出の振り分け
    let selected = null;
    let floatingEmote = '';

    // まずエモートに一致する画像設定があるか確認
    if (emoteKeyword) {
      selected = settings.find(s => s.emote === emoteKeyword && s.imageIdentifier);
    }

    if (selected) {
      // 画像設定がある場合：その画像を使用（浮遊はなし）
      console.log('[DynamicStand] Matched setting with image:', emoteKeyword);
    } else {
      // 設定がない、または画像がない場合：デフォルト画像 + 絵文字を浮かせる
      selected = settings.find(s => s.index === '1') || settings[0];
      floatingEmote = emoteKeyword;
      console.log('[DynamicStand] Floating emote mode:', emoteKeyword);
    }

    if (!selected) {
      console.warn('[DynamicStand] No valid setting found for character.');
      return;
    }

    this.renderStand(character.identifier, selected, speechText, floatingEmote);
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

  /**
   * キャラクターに新しい立ち絵設定の雛形を追加します。
   */
  addStandSetting(character: GameCharacter) {
    let section = character.detailDataElement.children.find(
      c => c instanceof DataElement && c.name === DYNAMIC_STAND_SECTION_NAME
    ) as DataElement;

    if (!section) {
      section = DataElement.create(DYNAMIC_STAND_SECTION_NAME, '', {}, DYNAMIC_STAND_SECTION_NAME + '_' + character.identifier);
      character.detailDataElement.appendChild(section);
    }

    // 次の連番を決定
    const indices = section.children
      .filter((c): c is DataElement => c instanceof DataElement)
      .map(c => parseInt(c.name))
      .filter(n => !isNaN(n));
    const nextIndex = indices.length > 0 ? Math.max(...indices) + 1 : 1;

    // 新しいグループを作成
    const group = DataElement.create(nextIndex.toString(), '', {}, nextIndex.toString() + '_' + character.identifier);
    group.appendChild(DataElement.create('emote', nextIndex === 1 ? '' : 'エモート名', {}, 'emote_' + group.identifier));
    group.appendChild(DataElement.create('imageIdentifier', '', { type: 'imageIdentifier' }, 'img_' + group.identifier));
    group.appendChild(DataElement.create('side', 'auto', {}, 'side_' + group.identifier)); // サイド優先度を追加
    group.appendChild(DataElement.create('offsetX', 20, { type: 'number' }, 'ox_' + group.identifier));
    group.appendChild(DataElement.create('offsetY', -20, { type: 'number' }, 'oy_' + group.identifier));

    section.appendChild(group);
    character.update();
  }

  private renderStand(characterId: string, setting: StandSetting, speechText: string, floatingEmote: string = '') {
    // 1. ステージ登壇判定
    if (!this.leftStage.includes(characterId) && !this.rightStage.includes(characterId)) {
      const pref = setting.sidePreference || 'auto';
      if (pref === 'left') {
        this.leftStage.unshift(characterId);
      } else if (pref === 'right') {
        this.rightStage.unshift(characterId);
      } else {
        // 左右交互に振り分け
        if (this.leftStage.length <= this.rightStage.length) {
          this.leftStage.unshift(characterId);
        } else {
          this.rightStage.unshift(characterId);
        }
      }
      // 他のキャラを押し出す
      this.repositionAll();
    }

    const objects = ObjectStore.instance.getObjects<OverlayObject>(OverlayObject);
    let stand = objects.find(obj => obj.type === 'image' && obj.label === 'stand_' + characterId);
    let speech = objects.find(obj => obj.type === 'speech' && obj.label === 'speech_' + characterId);
    let emote = objects.find(obj => obj.type === 'emote' && obj.label === 'emote_' + characterId);

    const duration = this.config.animationDuration;
    const easing = 'ease-out';

    // 現在のスタック位置から座標を算出
    const side = this.leftStage.includes(characterId) ? 'left' : 'right';
    const index = side === 'left' ? this.leftStage.indexOf(characterId) : this.rightStage.indexOf(characterId);
    const x = side === 'left' ? (this.config.edgeOffset + index * this.config.slideWidth) : (100 - this.config.edgeOffset - index * this.config.slideWidth);

    // --- 1. 立ち絵の処理 ---
    if (!stand) {
      stand = this.overlayService.createOverlay('image');
      stand.label = 'stand_' + characterId;
      stand.ownerPeerId = characterId;
      stand.anchor = 'bottom';
      stand.isClickToClose = false;
      stand.width = this.config.standWidth;
      stand.height = this.config.standHeight;
      stand.top = 100;
      
      // 初登場時は画面外に配置
      stand.transitionDuration = 0;
      stand.left = side === 'left' ? -this.config.standWidth : 100 + this.config.standWidth;
      stand.imageIdentifier = setting.imageIdentifier; 
      stand.opacity = 0;
      stand.scaleX = side === 'left' ? 1.0 : -1.0; // 右側なら反転
      stand.update();

      // DOM反映を待ってから目標位置へ
      setTimeout(() => {
        if (!stand) return;
        stand.transitionDuration = 800; // 登場は少しゆっくり
        stand.transitionEasing = 'cubic-bezier(0.22, 1, 0.36, 1)';
        stand.left = x;
        stand.opacity = 1.0;
        stand.update();
      }, 50);
    } else {
      // すでに存在する場合は通常のアニメーション
      stand.transitionDuration = duration;
      stand.transitionEasing = easing;
      stand.left = x;
      stand.imageIdentifier = setting.imageIdentifier;
      stand.opacity = 1.0;
      stand.scaleX = side === 'left' ? 1.0 : -1.0; // 配置サイドに合わせて反転
      stand.update();
    }

    // 吹き出しの最終的な座標計算用オフセット
    const actualOffsetX = side === 'left' ? setting.offsetX : -setting.offsetX;

    // --- 2. 吹き出しの処理 ---
    if (speechText) {
      if (!speech) {
        speech = this.overlayService.createOverlay('speech');
        speech.label = 'speech_' + characterId;
        speech.ownerPeerId = characterId;
        speech.anchor = 'bottom';
        speech.isClickToClose = false;
        speech.width = 30;
        speech.height = 10;
        
        // 初登場時は立ち絵に合わせて配置
        speech.transitionDuration = 0;
        speech.left = (side === 'left' ? -this.config.standWidth : 100 + this.config.standWidth) + actualOffsetX;
        speech.top = 100 + setting.offsetY;
        speech.opacity = 0;
        speech.updateContent('text', speechText);
        speech['lastOffsetX'] = setting.offsetX; // 元の値を保持
        speech.update();

        setTimeout(() => {
          if (!speech) return;
          speech.transitionDuration = 800;
          speech.transitionEasing = 'cubic-bezier(0.22, 1, 0.36, 1)';
          speech.left = x + actualOffsetX;
          speech.opacity = 1.0;
          speech.update();
        }, 50);
      } else {
        speech.transitionDuration = duration;
        speech.transitionEasing = easing;
        speech.left = x + actualOffsetX;
        speech['lastOffsetX'] = setting.offsetX;
        speech.top = 100 + setting.offsetY;
        speech.opacity = 1.0;
        speech.updateContent('text', speechText);
        speech.update();
      }
    } else if (speech) {
      speech.opacity = 0;
      speech.update();
    }

    // --- 3. 浮遊エモートの処理 ---
    if (floatingEmote) {
      if (!emote) {
        emote = this.overlayService.createOverlay('emote');
        emote.label = 'emote_' + characterId;
        emote.ownerPeerId = characterId;
        emote.anchor = 'bottom';
        emote.isClickToClose = false;
        emote.width = 10;
        emote.height = 10;
        emote.opacity = 0;
        emote.scale = this.config.emoteSize;
        emote.top = 100 + setting.offsetY; // 初期位置
        emote.updateContent('text', floatingEmote); // 内容をセット
        emote['lastOffsetX'] = setting.offsetX; // reposition用
        emote.update();

        setTimeout(() => {
          if (!emote) return;
          emote.transitionDuration = 800;
          emote.transitionEasing = 'cubic-bezier(0.175, 0.885, 0.32, 1.275)';
          emote.left = x;
          emote.opacity = 1.0;
          emote.update();
        }, 50);
      } else {
        emote.scale = this.config.emoteSize;
        emote.transitionDuration = duration;
        emote.transitionEasing = 'cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        emote.left = x; 
        emote.top = 100 + setting.offsetY; 
        emote.opacity = 1.0;
        emote.updateContent('text', floatingEmote);
        emote.update();
      }
    } else if (emote) {
      emote.opacity = 0;
      emote.update();
    }

    this.scheduleCleanup(characterId, this.config.displayDuration);
  }

  private cleanupTimers: Map<string, any> = new Map();

  private scheduleCleanup(characterId: string, ms: number) {
    // 既存のタイマーがあればキャンセル
    if (this.cleanupTimers.has(characterId)) {
      clearTimeout(this.cleanupTimers.get(characterId));
    }

    // 新しいタイマーをセット
    const timer = setTimeout(() => {
      // ステージから削除（引き寄せが発生）
      this.removeFromStage(characterId);

      const objects = ObjectStore.instance.getObjects<OverlayObject>(OverlayObject);
      const toDestroy = objects.filter(obj => 
        obj.label === 'stand_' + characterId || 
        obj.label === 'speech_' + characterId ||
        obj.label === 'emote_' + characterId
      );
      
      for (const obj of toDestroy) {
        // 退場アニメーション
        obj.transitionDuration = 500;
        obj.opacity = 0;
        obj.update();
        
        // アニメーション完了後に物理的に削除
        setTimeout(() => obj.destroy(), 500);
      }
      this.cleanupTimers.delete(characterId);
    }, ms);

    this.cleanupTimers.set(characterId, timer);
  }
}
