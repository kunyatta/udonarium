import { Injectable } from '@angular/core';
import { OverlayObject } from '../overlay-object';

@Injectable({
  providedIn: 'root'
})
export class OverlayEffectsService {
  constructor() {}

  /**
   * オブジェクトに開始状態をセットし、その後目標状態へアニメーションさせます。
   * @param obj 対象の OverlayObject
   * @param start 開始状態のプロパティ
   * @param target 目標状態のプロパティ
   * @param duration アニメーション時間 (ms)
   * @param easing イージング
   */
  applyTransition(
    obj: OverlayObject, 
    start: any, 
    target: any, 
    duration: number, 
    easing: string
  ) {
    // 1. まずアニメーション時間を0にして開始状態を即座に適用
    obj.transitionDuration = 0;
    
    // プロパティをコピー
    for (const key in start) {
      if (start.hasOwnProperty(key)) {
        (obj as any)[key] = start[key];
      }
    }
    obj.update();

    // 2. DOMの反映と同期を待ってから、アニメーション設定と目標状態を適用
    setTimeout(() => {
      obj.transitionDuration = duration;
      obj.transitionEasing = easing;
      
      for (const key in target) {
        if (target.hasOwnProperty(key)) {
          (obj as any)[key] = target[key];
        }
      }
      obj.update();
    }, 50);
  }
}