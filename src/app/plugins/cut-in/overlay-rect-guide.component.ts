import { Component, Input, OnInit, ChangeDetectorRef, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { OverlayObject } from '../overlay-object';
import { EventSystem } from '@udonarium/core/system';
import { ImageStorage } from '@udonarium/core/file-storage/image-storage';

@Component({
  selector: 'overlay-rect-guide',
  template: `
    <div class="rect-guide" 
         [style.width]="width" 
         [style.height]="height"
         [style.left]="left"
         [style.top]="top"
         [style.transform]="transform"
         [style.border-color]="borderColor"
         [style.border-width.px]="borderWidth"
         [style.z-index]="zIndex">
    </div>
    <!-- 画像のアスペクト比取得用 -->
    <img *ngIf="imageUrl && !overlayObject?.videoIdentifier" [src]="imageUrl" (load)="onImageLoad($event)" style="display:none">
  `,
  styles: [`
    .rect-guide {
      position: absolute;
      border-style: solid;
      box-sizing: border-box;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
      pointer-events: none;
    }
  `],
  changeDetection: ChangeDetectionStrategy.Default
})
export class OverlayRectGuideComponent implements OnInit, OnDestroy {
  @Input() overlayObjectIdentifier: string;
  @Input() overlayObject: OverlayObject = null;

  private imageAspectRatio: number = 1;

  constructor(private changeDetector: ChangeDetectorRef) {}

  get left() { return (this.overlayObject?.left || 0) + 'vw'; }
  get top() { return (this.overlayObject?.top || 0) + 'vh'; }
  
  get width() { 
    if (!this.overlayObject) return '0vw';
    if (this.overlayObject.width > 0) return this.overlayObject.width + 'vw';
    return (this.overlayObject.scale || 1) * 30 + 'vw';
  }

  get height() { 
    if (!this.overlayObject) return '0vw';
    if (this.overlayObject.height > 0) return this.overlayObject.height + 'vh';

    if (this.overlayObject.videoIdentifier) {
      const w = this.overlayObject.width > 0 ? this.overlayObject.width : (this.overlayObject.scale || 1) * 30;
      return (w / (16/9)) + 'vw';
    }

    const w = this.overlayObject.width > 0 ? this.overlayObject.width : (this.overlayObject.scale || 1) * 30;
    return (w / this.imageAspectRatio) + 'vw';
  }

  get borderColor() {
    switch (this.overlayObject?.type) {
      case 'rect-guide-in': return 'rgba(40, 167, 69, 0.7)'; // 緑
      case 'rect-guide-out': return 'rgba(220, 53, 69, 0.7)'; // 赤
      default: return 'rgba(0, 122, 255, 0.7)'; // 青
    }
  }

  get borderWidth() {
    // 開始・終了ガイドは少し細くする
    return (this.overlayObject?.type === 'rect-guide') ? 8 : 4;
  }

  get zIndex() { return 2000000; }
  get transform() { return `translate(-50%, -50%)`; }

  get imageUrl(): string {
    if (!this.overlayObject || !this.overlayObject.imageIdentifier) return '';
    const file = ImageStorage.instance.get(this.overlayObject.imageIdentifier);
    return file ? file.url : '';
  }

  onImageLoad(event: any) {
    const img = event.target;
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      this.imageAspectRatio = img.naturalWidth / img.naturalHeight;
      this.changeDetector.markForCheck();
    }
  }

  ngOnInit() {
    EventSystem.register(this)
      .on('UPDATE_GAME_OBJECT', event => {
        if (this.overlayObject && event.data.identifier === this.overlayObject.identifier) {
          this.changeDetector.markForCheck();
        }
      });
  }

  ngOnDestroy() {
    EventSystem.unregister(this);
  }
}