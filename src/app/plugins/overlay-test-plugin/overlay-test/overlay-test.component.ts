import { Component, Input, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { animate, style, transition, trigger } from '@angular/animations';
import { OverlayTestObject } from '../overlay-test-object';
import { EventSystem } from '@udonarium/core/system';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';

@Component({
  selector: 'app-overlay-test',
  templateUrl: './overlay-test.component.html',
  styleUrls: ['./overlay-test.component.css'],
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translate(-50%, -50%) scale(0.8)' }),
        animate('200ms ease-out', style({ opacity: 1, transform: 'translate(-50%, -50%) scale(1)' }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0, transform: 'translate(-50%, -50%) scale(0.8)' }))
      ])
    ])
  ]
})
export class OverlayTestComponent implements OnInit, OnDestroy {
  @Input() overlayObjectIdentifier: string;
  overlayObject: OverlayTestObject = null;

  // カットインに倣い、圧倒的に高い z-index を動的に設定
  get zIndex(): number {
    return 2000000;
  }

  constructor(private changeDetector: ChangeDetectorRef) {}

  ngOnInit() {
    this.overlayObject = ObjectStore.instance.get<OverlayTestObject>(this.overlayObjectIdentifier);
    if (!this.overlayObject) return;

    // GameObjectの更新を監視
    EventSystem.register(this)
      .on('UPDATE_GAME_OBJECT/identifier/' + this.overlayObjectIdentifier, event => {
        this.changeDetector.markForCheck();
      })
      .on('DELETE_GAME_OBJECT', event => {
        if (this.overlayObjectIdentifier === event.data.identifier) {
          // データが消えたら自分も消える（ライフサイクル自律化）
          this.overlayObject = null;
          this.changeDetector.markForCheck();
        }
      });
  }

  ngOnDestroy() {
    EventSystem.unregister(this);
  }

  close() {
    // 自身ではなく「データ」を消す。すると全員の画面から消える。
    if (this.overlayObject) {
      this.overlayObject.destroy();
    }
  }
}