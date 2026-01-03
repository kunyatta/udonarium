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
  protected expirationTimer: any;
  protected exitAnimationScheduled = false;

  constructor(
    private changeDetector: ChangeDetectorRef,
    public dynamicStandService: DynamicStandPluginService
  ) {}

  get stageActors(): any[] {
    const actors = this.dynamicStandService.localActors;
    if (actors.length > 0) {
      // console.log(`[OverlayComponent] Rendering ${actors.length} actors from service.`);
    }
    return actors;
  }

  getActorData(actor: any): any {
    // キーワード駆動方式では、リストの要素そのものが表示用データ
    return actor;
  }

  getActorImageUrl(imageIdentifier: string): string {
    if (!imageIdentifier) return '';
    const file = ImageStorage.instance.get(imageIdentifier);
    return file ? file.url : '';
  }

  closeLocal() {
    if (this.overlayObject && !this.overlayObject.isClickToClose) return;
    this.isVisible = false;
    this.audioPlayer.stop();
    this.changeDetector.markForCheck();
  }

  get left() { return (this.overlayObject?.left || 0) + 'vw'; }
  get top() { return (this.overlayObject?.top || 0) + 'vh'; }
  get width() { return this.overlayObject && this.overlayObject.width > 0 ? this.overlayObject.width + 'vw' : 'auto'; }
  get height() { return this.overlayObject && this.overlayObject.height > 0 ? this.overlayObject.height + 'vh' : 'auto'; }
  get zIndex() { return this.overlayObject?.zIndex || 2000000; }
  get opacity() { return this.overlayObject?.opacity ?? 1; }
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
    this.checkExpiration();
    this.startExpirationTimer();
    this.playAudioIfSet();

    EventSystem.register(this)
      .on('UPDATE_GAME_OBJECT/identifier/' + this.overlayObject.identifier, event => {
        this.checkExpiration();
        this.playAudioIfSet();
        this.changeDetector.markForCheck();
      })
      .on('UPDATE_GAME_OBJECT', event => {
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

  private startExpirationTimer() {
    this.stopExpirationTimer();
    if (!this.overlayObject || this.overlayObject.expirationTime <= 0) return;
    this.expirationTimer = setInterval(() => {
      this.checkExpiration();
      if (!this.overlayObject) this.stopExpirationTimer();
    }, 500);
  }

  private stopExpirationTimer() { if (this.expirationTimer) { clearInterval(this.expirationTimer); this.expirationTimer = null; } }

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

  private checkExpiration() {
    if (!this.overlayObject || this.overlayObject.expirationTime <= 0) return;
    const now = Date.now();
    const timeLeft = this.overlayObject.expirationTime - now;
    if (this.overlayObject.isMine) {
      if (timeLeft > 500) { if (!this.isVisible) { this.isVisible = true; this.changeDetector.markForCheck(); } }
      else if (timeLeft <= 500 && timeLeft > 0) { this.isVisible = false; this.changeDetector.markForCheck(); }
    } else {
      if (timeLeft < -30000 && this.isVisible) { this.isVisible = false; this.changeDetector.markForCheck(); }
      if (this.overlayObject.opacity > 0.1 && !this.isVisible && timeLeft > -30000) { this.isVisible = true; this.changeDetector.markForCheck(); }
    }
    if (timeLeft <= 0 && this.overlayObject.isMine) {
      const obj = this.overlayObject;
      this.overlayObject = null;
      obj.destroy();
    }
  }

  ngOnDestroy() { this.stopExpirationTimer(); this.audioPlayer.stop(); EventSystem.unregister(this); }
}