import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild, ChangeDetectorRef, ChangeDetectionStrategy, HostBinding } from '@angular/core';
import { OverlayObject } from '../../overlay-object';
import { ObjectNode } from '@udonarium/core/synchronize-object/object-node';
import { EventSystem } from '@udonarium/core/system';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { DataElement } from '@udonarium/data-element';
import { environment } from '../../../../environments/environment';
import { ImageStorage } from '@udonarium/core/file-storage/image-storage';
import { ImageFile } from '@udonarium/core/file-storage/image-file';
import { AudioPlayer, VolumeType } from '@udonarium/core/file-storage/audio-player';
import { AudioStorage } from '@udonarium/core/file-storage/audio-storage';
import { DynamicStandPluginService } from '../../dynamic-stand/dynamic-stand.service';
import { StandingActor } from '../../dynamic-stand/dynamic-stand.model';

@Component({
  selector: 'app-overlay',
  templateUrl: './overlay.component.html',
  styleUrls: ['./overlay.component.css'],
  changeDetection: ChangeDetectionStrategy.Default
})
export class OverlayComponent implements OnInit, OnDestroy {
  @Input() overlayObjectIdentifier: string;
  @Input() overlayObject: OverlayObject = null;
  @ViewChild('effectTarget', { static: true }) effectTargetRef: ElementRef<HTMLElement>;

  isProduction = environment.production;
  isVisible = true;

  protected audioPlayer: AudioPlayer = new AudioPlayer();
  private expirationTimer: any;
  
  // --- タイピング演出の管理 (Typing Logic) ---
  private visibleTexts: Map<string, string> = new Map();
  private typingTimers: Map<string, any> = new Map();
  private readonly TYPING_SPEED = 60; // 1文字あたりの表示速度 (ms)

  constructor(
    private changeDetector: ChangeDetectorRef,
    public dynamicStandService: DynamicStandPluginService
  ) {}

  /**
   * 現在の舞台に存在するアクターのリストを取得します。
   * 取得と同時にタイピング演出の更新チェックを行います。
   */
  get stageActors(): StandingActor[] {
    const actors = this.dynamicStandService.localActors;
    actors.forEach(actor => this.updateActorTyping(actor));
    return actors;
  }

  /**
   * テンプレートからアクターのデータを取得するためのヘルパー。
   */
  getActorData(actor: StandingActor): StandingActor {
    return actor;
  }

  /**
   * アクターごとのタイピング演出（文字送り）を管理します。
   * 前回の表示状態と比較し、差分がある場合にタイマーを起動します。
   */
  private updateActorTyping(actor: StandingActor) {
    const id = actor.characterId;
    const targetText = actor.speechText || '';
    let currentVisible = this.visibleTexts.get(id) || '';

    // セリフがリセットされたか、全く別のテキストになった場合はクリア
    if (!targetText.startsWith(currentVisible)) {
      currentVisible = '';
      this.visibleTexts.set(id, '');
    }

    // 文字送りが必要な場合
    if (currentVisible.length < targetText.length) {
      if (!this.typingTimers.has(id)) {
        const timer = setInterval(() => {
          let v = this.visibleTexts.get(id) || '';
          if (v.length < targetText.length) {
            v += targetText.charAt(v.length);
            this.visibleTexts.set(id, v);
            this.changeDetector.markForCheck();
          } else {
            this.stopActorTyping(id);
          }
        }, this.TYPING_SPEED);
        this.typingTimers.set(id, timer);
      }
    }
  }

  private stopActorTyping(id: string) {
    if (this.typingTimers.has(id)) {
      clearInterval(this.typingTimers.get(id));
      this.typingTimers.delete(id);
    }
  }

  /**
   * アクターの現在表示可能なセリフ（タイピング中の文字列）を取得します。
   */
  getVisibleSpeechText(actor: StandingActor): string {
    return this.visibleTexts.get(actor.characterId) || '';
  }

  /**
   * 画像識別子からURLを取得します。
   */
  getActorImageUrl(imageIdentifier: string): string {
    if (!imageIdentifier) return '';
    const file = ImageStorage.instance.get(imageIdentifier);
    return file ? file.url : '';
  }

  /**
   * ローカルでパネルを閉じます（クリックで閉じる設定が有効な場合）。
   */
  closeLocal() {
    if (this.overlayObject && !this.overlayObject.isClickToClose) return;
    this.isVisible = false;
    this.audioPlayer.stop();
    this.changeDetector.markForCheck();
  }

  // --- レイアウト計算用プロパティ ---
  get left() { return (this.overlayObject?.left || 0) + 'vw'; }
  get top() { return (this.overlayObject?.top || 0) + 'vh'; }
  get width() { return this.overlayObject && this.overlayObject.width > 0 ? this.overlayObject.width + 'vw' : 'auto'; }
  get height() { return this.overlayObject && this.overlayObject.height > 0 ? this.overlayObject.height + 'vh' : 'auto'; }
  get zIndex() { return this.overlayObject?.zIndex || 2000000; }
  get opacity() { return this.overlayObject?.opacity ?? 1; }
  
  /**
   * アンカー位置に基づいたトランスフォーム属性を計算します。
   */
  get transform() {
    const scale = this.overlayObject?.scale ?? 1;
    const scaleX = this.overlayObject?.scaleX ?? 1;
    const anchor = this.overlayObject?.anchor || 'center';
    let translateX = '-50%';
    let translateY = '-50%';
    switch (anchor) {
      case 'top': translateX = '-50%'; translateY = '0%'; break;
      case 'bottom': translateX = '-50%'; translateY = '-100%'; break;
      case 'left': translateX = '0%'; translateY = '-50%'; break;
      case 'right': translateX = '-100%'; translateY = '-50%'; break;
      case 'top-left': translateX = '0%'; translateY = '0%'; break;
      case 'top-right': translateX = '-100%'; translateY = '0%'; break;
      case 'bottom-left': translateX = '0%'; translateY = '-100%'; break;
      case 'bottom-right': translateX = '-100%'; translateY = '-100%'; break;
      default: translateX = '-50%'; translateY = '-50%'; break;
    }
    return `translate(${translateX}, ${translateY}) scale(${scale * scaleX}, ${scale})`;
  }

  get transition() {
    if (!this.overlayObject) return 'none';
    return `all ${this.overlayObject.transitionDuration}ms ${this.overlayObject.transitionEasing}`;
  }

  @HostBinding('style.pointer-events') get pointerEvents() { return this.isVisible ? 'auto' : 'none'; }
  @HostBinding('style.display') get display() { return this.isVisible ? 'block' : 'none'; }

  /**
   * ビデオ再生準備完了時の処理。動画の長さに合わせて寿命を設定します。
   */
  onPlayerReady(event: any) {
    if (!this.overlayObject || !this.overlayObject.isMine) return;
    const duration = event.target.getDuration();
    if (duration > 0) {
      this.overlayObject.expirationTime = Date.now() + (duration * 1000) + 15000;
      this.overlayObject.update();
    }
  }

  onPlayerStateChange(event: any) {
    if (event && event.data === 0) this.closeLocal();
  }

  /**
   * オーバーレイ全体のスタイルを決定します。舞台（standing-stage）の場合は全画面化します。
   */
  get wrapperStyle() {
    if (!this.overlayObject) return { display: 'none' };
    if (this.overlayObject.type === 'standing-stage') return { 'width': '100vw', 'height': '100vh', 'pointer-events': 'none' };
    return { 'width': this.overlayObject.width > 0 ? this.overlayObject.width + 'vw' : 'auto', 'height': this.overlayObject.height > 0 ? this.overlayObject.height + 'vh' : 'auto' };
  }

  get hasFrame(): boolean { return (this.overlayObject?.width > 0 || this.overlayObject?.height > 0); }
  get videoId(): string | undefined { return this.overlayObject?.type === 'video' ? this.overlayObject?.videoIdentifier : undefined; }
  get videoWidth(): number | undefined { return (!this.overlayObject || this.overlayObject.width <= 0) ? undefined : (window.innerWidth * this.overlayObject.width) / 100; }
  get videoHeight(): number | undefined {
    if (!this.overlayObject) return undefined;
    if (this.overlayObject.height > 0) return (window.innerHeight * this.overlayObject.height) / 100;
    const widthPx = this.videoWidth;
    return widthPx ? (widthPx * 9) / 16 : undefined;
  }

  /**
   * 表示する画像のURLを取得します。
   */
  get imageUrl(): string {
    if (!this.overlayObject) return '';
    if (this.overlayObject.imageIdentifier && this.overlayObject.type !== 'video') {
       const file = ImageStorage.instance.get(this.overlayObject.imageIdentifier);
       if (file) return file.url;
    }
    const content = this.overlayObject.content;
    if (content) {
      for (const child of content.children) {
        if (child instanceof DataElement && child.name === 'url') {
          const file = ImageStorage.instance.get(child.value as string);
          if (file) return file.url;
        }
      }
    }
    return '';
  }

  ngOnInit() {
    if (!this.overlayObject && this.overlayObjectIdentifier) {
      this.overlayObject = ObjectStore.instance.get<OverlayObject>(this.overlayObjectIdentifier);
    }
    if (!this.overlayObject) return;
    this.startExpirationTimer();
    this.playAudioIfSet();

    EventSystem.register(this)
      .on('UPDATE_GAME_OBJECT/identifier/' + this.overlayObject.identifier, event => {
        this.playAudioIfSet();
        this.changeDetector.markForCheck();
      })
      .on('UPDATE_GAME_OBJECT', event => {
        // 舞台オブジェクトそのもの、あるいはその子要素が更新された場合に再描画を促す
        if (this.overlayObject && this.overlayObject.type === 'standing-stage') {
          const updatedObj = ObjectStore.instance.get<ObjectNode>(event.data.identifier);
          if (updatedObj && (updatedObj.identifier === this.overlayObject.identifier || updatedObj.parentId === this.overlayObject.identifier)) {
            this.changeDetector.markForCheck();
          }
        }
      })
      .on('CHANGE_JUKEBOX_VOLUME', event => { this.changeDetector.markForCheck(); })
      .on('DELETE_GAME_OBJECT', event => {
        if (this.overlayObject && this.overlayObject.identifier === event.data.identifier) {
          this.overlayObject = null;
          this.audioPlayer.stop();
          this.changeDetector.markForCheck();
        }
      });
  }

  /**
   * 寿命監視タイマーを開始します。
   */
  private startExpirationTimer() {
    this.stopExpirationTimer();
    if (!this.overlayObject || this.overlayObject.expirationTime <= 0) return;
    this.expirationTimer = setInterval(() => {
      this.checkExpiration();
      if (!this.overlayObject) this.stopExpirationTimer();
    }, 1000);
  }

  private stopExpirationTimer() { if (this.expirationTimer) { clearInterval(this.expirationTimer); this.expirationTimer = null; } }

  /**
   * オブジェクトに紐づく効果音がある場合、再生します。
   */
  private playAudioIfSet() {
    if (!this.overlayObject || !this.isVisible) return;
    const content = this.overlayObject.content;
    if (!content) return;
    const audioIdElm = content.children.find(c => (c instanceof DataElement) && c.name === 'audioIdentifier') as DataElement;
    if (audioIdElm && audioIdElm.value) {
      const audioId = audioIdElm.value as string;
      if (this.audioPlayer.audio && this.audioPlayer.audio.identifier === audioId && !this.audioPlayer.paused) return;
      const audio = AudioStorage.instance.get(audioId);
      if (audio && audio.isReady) {
        this.audioPlayer.stop();
        this.audioPlayer.play(audio);
      }
    }
  }

  /**
   * 寿命（有効期限）をチェックし、期限切れの場合はオブジェクトを破棄または非表示にします。
   */
  private checkExpiration() {
    if (!this.overlayObject || this.overlayObject.expirationTime <= 0) return;

    // ----- MODIFICATION (Gemini) -----
    // 舞台オブジェクト（standing-stage）はサービス側でアクターの寿命を管理するため、
    // ここでの個別の寿命チェック（オブジェクト自体の破棄）はスキップする。
    if (this.overlayObject.type === 'standing-stage') return;
    // ---------------------------------

    const now = Date.now();
    const timeLeft = this.overlayObject.expirationTime - now;
    if (this.overlayObject.isMine) {
      if (timeLeft > 500) { if (!this.isVisible) { this.isVisible = true; this.changeDetector.markForCheck(); } }
      else if (timeLeft <= 500 && timeLeft > 0) { this.isVisible = false; this.changeDetector.markForCheck(); }
    } else {
      // 他人のオブジェクトの場合、安全のため広めのバッファを持って消去
      if (timeLeft < -30000 && this.isVisible) { this.isVisible = false; this.changeDetector.markForCheck(); }
      if (this.overlayObject.opacity > 0.1 && !this.isVisible && timeLeft > -30000) { this.isVisible = true; this.changeDetector.markForCheck(); }
    }
    
    // 期限切れかつ所有者の場合、物理的に削除する
    if (timeLeft <= 0 && this.overlayObject.isMine) {
      const obj = this.overlayObject;
      this.overlayObject = null;
      obj.destroy();
    }
  }

  ngOnDestroy() { 
    this.stopExpirationTimer(); 
    this.audioPlayer.stop(); 
    this.typingTimers.forEach(t => clearInterval(t));
    EventSystem.unregister(this); 
  }
}