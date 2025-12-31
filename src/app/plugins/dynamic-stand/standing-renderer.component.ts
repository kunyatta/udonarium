import { Component, Input, ChangeDetectorRef, ChangeDetectionStrategy, HostBinding, OnInit, OnDestroy } from '@angular/core';
import { OverlayObject } from '../overlay-object';
import { ImageStorage } from '@udonarium/core/file-storage/image-storage';
import { DataElement } from '@udonarium/data-element';
import { EventSystem } from '@udonarium/core/system';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';

@Component({
  selector: 'app-standing-renderer',
  templateUrl: './standing-renderer.component.html',
  styleUrls: ['./standing-renderer.component.css']
})
export class StandingRendererComponent implements OnInit, OnDestroy {
  @Input() overlayObject: OverlayObject;
  @Input() overlayObjectIdentifier: string;

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

  constructor(private changeDetector: ChangeDetectorRef) {}

  ngOnInit() {
    this.initializeObject();
  }

  private isInitialized = false;
  private initializeObject() {
    if (this.isInitialized) return;

    if (!this.overlayObject && this.overlayObjectIdentifier) {
      this.overlayObject = ObjectStore.instance.get<OverlayObject>(this.overlayObjectIdentifier);
    }
    
    if (this.overlayObject) {
      this.isInitialized = true;
      // オブジェクトの更新を監視して再描画をトリガーする
      EventSystem.register(this)
        .on('UPDATE_GAME_OBJECT/identifier/' + this.overlayObject.identifier, event => {
          this.overlayObject = ObjectStore.instance.get<OverlayObject>(this.overlayObject.identifier);
          this.changeDetector.markForCheck(); // detectChanges ではなく markForCheck を使用 (安全)
        });
    }
  }

  ngOnDestroy() {
    EventSystem.unregister(this);
  }

  get speechText(): string {
    const content = this.overlayObject?.content;
    if (!content) return '';
    const textElm = content.children.find(c => (c instanceof DataElement) && c.name === 'text') as DataElement;
    return textElm ? textElm.value as string : '';
  }
}
