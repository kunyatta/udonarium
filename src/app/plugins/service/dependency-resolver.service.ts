import { Injectable, Type } from '@angular/core';
import { combineLatest, firstValueFrom, Observable, of, TimeoutError } from 'rxjs';
import { filter, take, timeout } from 'rxjs/operators';
import { EventSystem } from '@udonarium/core/system';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { GameObject } from '@udonarium/core/synchronize-object/game-object';

// 依存関係の定義を表すインターフェース
export interface Dependency<T> {
  prop: keyof T;
  type: Type<any>;
}

@Injectable({
  providedIn: 'root'
})
export class DependencyResolverService {

  constructor() { }

  /**
   * 指定したオブジェクトの依存関係がすべて解決されるのを待つ。
   * @param target 依存関係を解決したいオブジェクト。
   * @param dependencies 解決すべき依存関係の定義配列。
   * @param timeoutMs タイムアウトまでの時間（ミリ秒）。デフォルトは5000ms。
   * @returns 全ての依存関係が解決されたことを示すPromise。タイムアウトした場合はエラーを投げる。
   */
  async whenReady<T>(
    target: T,
    dependencies: Dependency<T>[],
    timeoutMs: number = 5000
  ): Promise<void> {

    if (dependencies.length === 0) {
      return Promise.resolve();
    }

    // 各依存関係のidentifierに対応するObservableの配列を作成
    const observables = dependencies.map(dep => {
      const identifier = target[dep.prop] as unknown as string;
      return this.observeObjectById(identifier);
    });

    // すべてのObservableを結合
    const combined$ = combineLatest(observables).pipe(
      // すべての依存オブジェクトがnullやundefinedでないことを確認
      filter(resolvedObjects => resolvedObjects.every(obj => obj != null)),
      // タイムアウト設定
      timeout(timeoutMs),
      // 条件を満たした最初の1回だけ取得
      take(1)
    );

    try {
      // Observableが完了するのを待つ (Promiseに変換)
      await firstValueFrom(combined$);
    } catch (err) {
      if (err instanceof TimeoutError) {
        console.error('Dependency resolution timed out.', { target, dependencies });
        throw new Error('依存関係の解決がタイムアウトしました。');
      } else {
        console.error('An unexpected error occurred during dependency resolution.', { target, dependencies, err });
        throw err;
      }
    }
  }

  /**
   * 指定されたIDのGameObjectが存在するまで待機し、そのオブジェクトを放出するObservableを返す。
   * @param identifier 待機するGameObjectのID
   * @returns GameObjectを放出するObservable
   */
  private observeObjectById(identifier: string): Observable<GameObject> {
    return new Observable(subscriber => {
      // まずObjectStoreにオブジェクトが既に存在するか確認
      const existingObject = ObjectStore.instance.get(identifier);
      if (existingObject) {
        subscriber.next(existingObject);
        subscriber.complete();
        return;
      }

      // オブジェクトが存在しない場合、ADD_GAME_OBJECTイベントをリッスン
      const listener = EventSystem.register(this)
        .on('ADD_GAME_OBJECT', event => {
          if (event.data.identifier === identifier) {
            const newObject = ObjectStore.instance.get(identifier);
            if (newObject) {
              subscriber.next(newObject);
              subscriber.complete();
            }
            // イベントリスナーを解除
            EventSystem.unregister(this, listener.eventName);
          }
        });

      // Observableが破棄されるときにリスナーをクリーンアップ
      return () => {
        EventSystem.unregister(this, listener.eventName);
      };
    });
  }
}
