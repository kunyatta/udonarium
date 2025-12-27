import { Injectable } from '@angular/core';
import { OverlayObject } from '../overlay-object';

export interface IOverlayEffect {
  apply(element: HTMLElement, duration: number, params: any): Promise<void>;
}

@Injectable({
  providedIn: 'root'
})
export class OverlayEffectsService {
  private effectRegistry: Map<string, IOverlayEffect> = new Map();

  constructor() {
    this.registerDefaultEffects();
  }

  registerEffect(name: string, effect: IOverlayEffect) {
    this.effectRegistry.set(name, effect);
  }

  getEffect(name: string): IOverlayEffect | undefined {
    return this.effectRegistry.get(name);
  }

  /**
   * OverlayObjectのタスクキューを処理する (現在はダミー)
   * @param overlayObject 対象のオブジェクト
   * @param element 演出を適用するDOM要素
   */
  async processQueue(overlayObject: OverlayObject, element: HTMLElement): Promise<void> {
    // 演出機能は現在停止中 (ダミー)
    // 将来的に OverlayComponent にあったキュー処理ロジックをここに移植する予定
    return;
  }

  private registerDefaultEffects() {
    // 演出機能リトライのため、登録ロジックは残すが実装は空にする、あるいは登録を控える
    /*
    this.registerEffect('fade-in', {
      apply: async (el, duration) => {
        // Dummy
      }
    });
    */
  }
}