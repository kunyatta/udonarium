import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild, ChangeDetectorRef, ChangeDetectionStrategy, HostBinding } from '@angular/core';
import { OverlayObject } from '../../overlay-object';
import { OverlayEffectsService } from '../../service/overlay-effects.service';
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

  @HostBinding('style.left.%') get hostLeft() { return this.overlayObject?.left || 0; }
  @HostBinding('style.top.%') get hostTop() { return this.overlayObject?.top || 0; }
  @HostBinding('style.z-index') get hostZIndex() { return this.overlayObject?.zIndex || 2000000; }
  @HostBinding('style.pointer-events') get pointerEvents() { return this.isVisible ? 'auto' : 'none'; }
  @HostBinding('style.display') get display() { return this.isVisible ? 'block' : 'none'; }

  constructor(
    private changeDetector: ChangeDetectorRef,
    private effectsService: OverlayEffectsService
  ) {}

  closeLocal() {
    this.isVisible = false;
    this.audioPlayer.stop();
    this.changeDetector.markForCheck();
  }

  get wrapperStyle() {
    if (!this.overlayObject) return { display: 'none' };
    
    return {
      'opacity': this.overlayObject.opacity,
      'transform': `translate(-50%, -50%) scale(${this.overlayObject.scale})`, // Fix centering
      'width': this.overlayObject.width > 0 ? this.overlayObject.width + 'vw' : 'auto',
      'height': this.overlayObject.height > 0 ? this.overlayObject.height + 'vh' : 'auto'
    };
  }

  get hasFrame(): boolean {
    return (this.overlayObject?.width > 0 || this.overlayObject?.height > 0);
  }

  get videoId(): string | undefined {
    if (this.overlayObject?.type !== 'video') return undefined;
    return this.overlayObject?.sourceIdentifier;
  }

  get videoWidth(): number | undefined {
    if (!this.overlayObject || this.overlayObject.width <= 0) return undefined;
    // vw -> px conversion
    return (window.innerWidth * this.overlayObject.width) / 100;
  }

  get videoHeight(): number | undefined {
    if (!this.overlayObject || this.overlayObject.height <= 0) return undefined;
    // vh -> px conversion
    return (window.innerHeight * this.overlayObject.height) / 100;
  }

  get imageUrl(): string {
    if (!this.overlayObject) return '';
    
    // 0. SourceIdentifierによる解決 (新規)
    if (this.overlayObject.sourceIdentifier && this.overlayObject.type !== 'video') {
       const file = ImageStorage.instance.get(this.overlayObject.sourceIdentifier);
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
        // 演出処理をサービスに移譲 (現在はダミー)
        if (this.effectTargetRef) {
          this.effectsService.processQueue(this.overlayObject, this.effectTargetRef.nativeElement);
        }
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

    // 初回実行
    if (this.effectTargetRef) {
      this.effectsService.processQueue(this.overlayObject, this.effectTargetRef.nativeElement);
    }
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

    // 現在時刻が有効期限を過ぎていたら非表示にする
    if (Date.now() > this.overlayObject.expirationTime) {
      if (this.isVisible) {
        console.log('[Overlay] Expired:', this.overlayObject.identifier);
        this.isVisible = false;
        this.audioPlayer.stop();
        // 注意: ここでdestroy()を呼ぶとP2P同期で他人の画面からも消してしまう恐れがあるため、
        // あくまで「自分の画面での非表示」に留める。
        // 本当の削除は所有者のタイマーに任せる。
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