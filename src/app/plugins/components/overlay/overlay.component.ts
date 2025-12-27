import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild, ChangeDetectorRef, ChangeDetectionStrategy, HostBinding } from '@angular/core';
import { OverlayObject } from '../../overlay-object';
import { OverlayEffectsService } from '../../service/overlay-effects.service';
import { EventSystem } from '@udonarium/core/system';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { DataElement } from '@udonarium/data-element';
import { environment } from '../../../../environments/environment';
import { ImageStorage } from '@udonarium/core/file-storage/image-storage';
import { ImageFile } from '@udonarium/core/file-storage/image-file';

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

  @HostBinding('style.left.%') get hostLeft() { return this.overlayObject?.left || 0; }
  @HostBinding('style.top.%') get hostTop() { return this.overlayObject?.top || 0; }
  @HostBinding('style.z-index') get hostZIndex() { return this.overlayObject?.zIndex || 2000000; }
  @HostBinding('style.pointer-events') get pointerEvents() { return 'none'; }

  constructor(
    private changeDetector: ChangeDetectorRef,
    private effectsService: OverlayEffectsService
  ) {}

  get wrapperStyle() {
    if (!this.overlayObject) return { display: 'none' };
    
    return {
      'opacity': this.overlayObject.opacity,
      'transform': `scale(${this.overlayObject.scale})`,
      'width': this.overlayObject.width > 0 ? this.overlayObject.width + 'vw' : 'auto',
      'height': this.overlayObject.height > 0 ? this.overlayObject.height + 'vh' : 'auto'
    };
  }

  get hasFrame(): boolean {
    return (this.overlayObject?.width > 0 || this.overlayObject?.height > 0);
  }

  get imageUrl(): string {
    if (!this.overlayObject) return '';
    
    // 1. UUID (imageIdentifier) による解決を最優先する
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

    EventSystem.register(this)
      .on('UPDATE_GAME_OBJECT/identifier/' + this.overlayObject.identifier, event => {
        // 同期された値を反映
        this.changeDetector.markForCheck();
        // 演出処理をサービスに移譲 (現在はダミー)
        if (this.effectTargetRef) {
          this.effectsService.processQueue(this.overlayObject, this.effectTargetRef.nativeElement);
        }
      })
      .on('DELETE_GAME_OBJECT', event => {
        if (this.overlayObject && this.overlayObject.identifier === event.data.identifier) {
          this.overlayObject = null;
          this.changeDetector.markForCheck();
        }
      });

    // 初回実行
    if (this.effectTargetRef) {
      this.effectsService.processQueue(this.overlayObject, this.effectTargetRef.nativeElement);
    }
  }

  ngOnDestroy() {
    console.log('[Overlay] Component Destroyed');
    EventSystem.unregister(this);
  }
}