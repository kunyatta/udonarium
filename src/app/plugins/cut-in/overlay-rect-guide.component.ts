import { Component, Input, OnInit, ChangeDetectorRef, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { OverlayObject } from '../overlay-object';
import { EventSystem } from '@udonarium/core/system';
import { ImageStorage } from '@udonarium/core/file-storage/image-storage';
import { DataElement } from '@udonarium/data-element';

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
      opacity: 0.8;
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
    const scale = this.overlayObject.scale || 1;
    // 画面比率モード
    if (this.overlayObject.width > 0) return (this.overlayObject.width * scale) + 'vw';
    // 拡大率モード時の基準幅 (30vw) に倍率を適用
    return (30 * scale) + 'vw';
  }

  get height() { 
    if (!this.overlayObject) return '0vw';
    const scale = this.overlayObject.scale || 1;
    
    // 明示的に高さが指定されている場合
    if (this.overlayObject.height > 0) return (this.overlayObject.height * scale) + 'vh';

    // アスペクト比に基づく計算
    let aspectRatio = 1;
    if (this.overlayObject.videoIdentifier) {
      const isShorts = this.getIsShorts();
      aspectRatio = isShorts ? (9 / 16) : (16 / 9);
    } else {
      aspectRatio = this.imageAspectRatio;
    }

    const baseW = this.overlayObject.width > 0 ? this.overlayObject.width : 30;
    return ((baseW * scale) / aspectRatio) + 'vw';
  }

  private getIsShorts(): boolean {
    if (!this.overlayObject) return false;
    const content = this.overlayObject.content;
    if (content) {
      const elm = content.children.find(c => (c instanceof DataElement) && c.name === 'isShorts') as DataElement;
      return elm && elm.value == 1;
    }
    return false;
  }

  get borderColor() {
    switch (this.overlayObject?.type) {
      case 'rect-guide-in': return 'rgba(40, 167, 69, 1.0)';
      case 'rect-guide-out': return 'rgba(220, 53, 69, 1.0)';
      default: return 'rgba(0, 122, 255, 1.0)';
    }
  }

  get borderWidth() {
    // scaleに依存せず、常に 8px / 4px を維持
    return (this.overlayObject?.type === 'rect-guide') ? 8 : 4;
  }

  get zIndex() { 
    return (this.overlayObject?.type === 'rect-guide') ? 2000001 : 2000000;
  }
  
  get transform() {
    // scale() を除去し、常に 100% の描画にする（サイズは width/height で調整済み）
    return `translate(-50%, -50%)`;
  }

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
