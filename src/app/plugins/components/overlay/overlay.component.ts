import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild, ChangeDetectorRef, ChangeDetectionStrategy, HostBinding } from '@angular/core';
import { OverlayObject } from '../../overlay-object';
import { EventSystem } from '@udonarium/core/system';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { DataElement } from '@udonarium/data-element';
import { environment } from '../../../../environments/environment';
import { ImageStorage } from '@udonarium/core/file-storage/image-storage';
import { ImageFile } from '@udonarium/core/file-storage/image-file';
import { AudioPlayer, VolumeType } from '@udonarium/core/file-storage/audio-player';
import { AudioStorage } from '@udonarium/core/file-storage/audio-storage';

@Component({
  selector: 'app-overlay',
  templateUrl: './overlay.component.html',
  styleUrls: ['./overlay.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverlayComponent implements OnInit, OnDestroy {
  @Input() overlayObjectIdentifier: string;
  @Input() overlayObject: OverlayObject = null;
  @ViewChild('effectTarget', { static: true }) effectTargetRef: ElementRef<HTMLElement>;

  isProduction = environment.production;
  isVisible = true; // Local visibility flag

  private audioPlayer: AudioPlayer = new AudioPlayer();
  private expirationTimer: any;
  private exitAnimationScheduled = false;

  // 計算用のゲッター
  get left() { return (this.overlayObject?.left || 0) + 'vw'; }
  get top() { return (this.overlayObject?.top || 0) + 'vh'; }
  get width() { return this.overlayObject && this.overlayObject.width > 0 ? this.overlayObject.width + 'vw' : 'auto'; }
  get height() { return this.overlayObject && this.overlayObject.height > 0 ? this.overlayObject.height + 'vh' : 'auto'; }
  get zIndex() { return this.overlayObject?.zIndex || 2000000; }
  get opacity() { return this.overlayObject?.opacity ?? 1; }
  get transform() {
    const scale = this.overlayObject?.scale ?? 1;
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
      case 'center': 
      default: translateX = '-50%'; translateY = '-50%'; break;
    }

    return `translate(${translateX}, ${translateY}) scale(${scale})`;
  }
  get transition() {
    if (!this.overlayObject) return 'none';
    return `all ${this.overlayObject.transitionDuration}ms ${this.overlayObject.transitionEasing}`;
  }

  @HostBinding('style.pointer-events') get pointerEvents() { return this.isVisible ? 'auto' : 'none'; }
  @HostBinding('style.display') get display() { return this.isVisible ? 'block' : 'none'; }

  constructor(
    private changeDetector: ChangeDetectorRef
  ) {}

  closeLocal() {
    if (this.overlayObject && !this.overlayObject.isClickToClose) return;
    this.isVisible = false;
    this.audioPlayer.stop();
    this.changeDetector.markForCheck();
  }

  /**
   * YouTubeプレーヤーの準備が整ったら、動画の長さを取得して同期します
   */
  onPlayerReady(event: any) {
    if (!this.overlayObject || !this.overlayObject.isMine) return;

    const duration = event.target.getDuration();
    if (duration > 0) {
      console.log('[Overlay] Auto-detected video duration:', duration, '(+15s buffer)');
      // 動画の長さ + 15秒のバッファを持たせることで、ラグがあるプレイヤーも最後まで見れるようにする
      this.overlayObject.expirationTime = Date.now() + (duration * 1000) + 15000;
      this.overlayObject.update();
    }
  }

  /**
   * YouTubeプレーヤーの状態変化をハンドルします
   */
  onPlayerStateChange(event: any) {
    // 0 は YT.PlayerState.ENDED (再生終了)
    if (event && event.data === 0) {
      console.log('[Overlay] Video playback ended (Local hide).');
      // 自分の画面上だけで非表示にする。
      // 全員への同期削除は、所有者の duration タイマーまたは手動停止に任せる。
      this.closeLocal();
    }
  }

  get wrapperStyle() {
    if (!this.overlayObject) return { display: 'none' };
    
    return {
      'width': this.overlayObject.width > 0 ? this.overlayObject.width + 'vw' : 'auto',
      'height': this.overlayObject.height > 0 ? this.overlayObject.height + 'vh' : 'auto'
    };
  }

  get hasFrame(): boolean {
    return (this.overlayObject?.width > 0 || this.overlayObject?.height > 0);
  }

  get videoId(): string | undefined {
    if (this.overlayObject?.type !== 'video') return undefined;
    return this.overlayObject?.videoIdentifier;
  }

  get videoWidth(): number | undefined {
    if (!this.overlayObject || this.overlayObject.width <= 0) return undefined;
    // vw -> px conversion
    return (window.innerWidth * this.overlayObject.width) / 100;
  }

  get videoHeight(): number | undefined {
    if (!this.overlayObject) return undefined;
    if (this.overlayObject.height > 0) {
      // vh -> px conversion
      return (window.innerHeight * this.overlayObject.height) / 100;
    }
    // 高さが指定されていない場合、横幅から 16:9 の比率で計算する
    const widthPx = this.videoWidth;
    if (widthPx) {
      return (widthPx * 9) / 16;
    }
    return undefined;
  }

  get imageUrl(): string {
    if (!this.overlayObject) return '';
    
    // 0. imageIdentifierによる解決 (標準)
    if (this.overlayObject.imageIdentifier && this.overlayObject.type !== 'video') {
       const file = ImageStorage.instance.get(this.overlayObject.imageIdentifier);
       if (file) return file.url;
    }
    
    // 1. UUID (imageIdentifier) による解決 (互換)
    if (this.overlayObject.imageIdentifier) {
      const file = ImageStorage.instance.get(this.overlayObject.imageIdentifier);
      if (file) return file.url;
    }

    // 2. ファイル名 (imageName) による解決 (レアケース・デバッグ用)
    if (this.overlayObject.imageName) {
      const file = this.findImageByFileName(this.overlayObject.imageName);
      if (file) return file.url;
    }

    // 3. データ要素 (content) 内の url による解決 (従来方式との互換性)
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

  private findImageByFileName(fileName: string): ImageFile | null {
    const images = ImageStorage.instance.images;
    let match = images.find(img => img.name === fileName);
    if (match) return match;
    const baseName = fileName.replace(/\.[^/.]+$/, "");
    match = images.find(img => img.name.replace(/\.[^/.]+$/, "") === baseName);
    return match || null;
  }

  ngOnInit() {
    console.log('[Overlay] Component Initialized');
    if (!this.overlayObject && this.overlayObjectIdentifier) {
      this.overlayObject = ObjectStore.instance.get<OverlayObject>(this.overlayObjectIdentifier);
    }
    if (!this.overlayObject) return;

    // 有効期限の監視開始
    this.checkExpiration();
    this.startExpirationTimer();
    this.playAudioIfSet();

    EventSystem.register(this)
      .on('UPDATE_GAME_OBJECT/identifier/' + this.overlayObject.identifier, event => {
        // 同期された値を反映
        this.checkExpiration();
        this.playAudioIfSet();
        this.changeDetector.markForCheck();
      })
      .on('CHANGE_JUKEBOX_VOLUME', event => {
        this.changeDetector.markForCheck();
      })
      .on('DELETE_GAME_OBJECT', event => {
        if (this.overlayObject && this.overlayObject.identifier === event.data.identifier) {
          this.overlayObject = null;
          this.audioPlayer.stop();
          this.changeDetector.markForCheck();
        }
      });
  }

  private startExpirationTimer() {
    this.stopExpirationTimer();
    if (!this.overlayObject || this.overlayObject.expirationTime <= 0) return;

    this.expirationTimer = setInterval(() => {
      this.checkExpiration();
      if (!this.isVisible) {
        this.stopExpirationTimer();
      }
    }, 500);
  }

  private stopExpirationTimer() {
    if (this.expirationTimer) {
      clearInterval(this.expirationTimer);
      this.expirationTimer = null;
    }
  }

  private playAudioIfSet() {
    if (!this.overlayObject || !this.isVisible) return;
    const content = this.overlayObject.content;
    if (!content) return;

    const audioIdElm = content.children.find(c => (c instanceof DataElement) && c.name === 'audioIdentifier') as DataElement;
    const isLoopElm = content.children.find(c => (c instanceof DataElement) && c.name === 'isLoop') as DataElement;

    if (audioIdElm && audioIdElm.value) {
      const audioId = audioIdElm.value as string;
      const isLoop = isLoopElm ? !!isLoopElm.value : false;
      
      // すでに同じ音源がセットされている場合は重ねて再生しない
      if (this.audioPlayer.audio && this.audioPlayer.audio.identifier === audioId && !this.audioPlayer.paused) {
        return;
      }

      const audio = AudioStorage.instance.get(audioId);
      if (audio && audio.isReady) {
        this.audioPlayer.stop(); // 念のため一度止める
        this.audioPlayer.loop = isLoop;
        this.audioPlayer.play(audio);
      }
    }
  }

  private checkExpiration() {
    if (!this.overlayObject || this.overlayObject.expirationTime <= 0) return;

    const now = Date.now();
    const timeLeft = this.overlayObject.expirationTime - now;

    // 1. 退場アニメーションのトリガー (残り時間が transitionDuration 以下になったら)
    const outDuration = 500; // 本来はObjectから取得すべきだが、まずは固定値でテスト
    if (timeLeft <= outDuration && !this.exitAnimationScheduled) {
      this.exitAnimationScheduled = true;
      console.log('[Overlay] Triggering Exit Animation');
      this.isVisible = false; // ローカルでの非表示開始
      this.changeDetector.markForCheck();
    }

    // 2. 最終的な削除判定
    if (timeLeft <= 0) {
      if (this.isVisible) {
        console.log('[Overlay] Expired:', this.overlayObject.identifier);
        this.isVisible = false;
        this.audioPlayer.stop();
        this.changeDetector.markForCheck();
      }

      // 所有者のみが GameObject を破棄する責務を負う
      if (this.overlayObject.isMine) {
        console.log('[Overlay] Owner destroying object.');
        const obj = this.overlayObject;
        this.overlayObject = null;
        obj.destroy();
      }
    }
  }

  ngOnDestroy() {
    console.log('[Overlay] Component Destroyed');
    this.stopExpirationTimer();
    this.audioPlayer.stop();
    EventSystem.unregister(this);
  }
}