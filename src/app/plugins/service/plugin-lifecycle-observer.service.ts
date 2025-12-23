import { Injectable, NgZone } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { EventSystem } from '@udonarium/core/system';
import { GameObject } from '@udonarium/core/synchronize-object/game-object';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';

export interface LifecycleEvents {
  add$: Observable<GameObject>;
  update$: Observable<GameObject>;
  delete$: Observable<GameObject | null>;
}

/**
 * UdonariumのGameObjectのライフサイクルイベントを監視し、
 * リアクティブなストリーム（Observable）として提供する汎用サービスです。
 *
 * @description
 * このサービスを利用することで、特定のGameObjectが追加、更新、削除された際に、
 * AngularコンポーネントやサービスからRxJSのObservableとしてイベントを購読できます。
 * UdonariumのGameObjectの「死と再生」のサイクルに、Angularアプリケーションが追従するのに役立ちます。
 * EventSystemのイベントはAngularのゾーン外で発行されるため、`NgZone.run`を使用して
 * Angularの変更検知サイクルを適切にトリガーします。
 */
@Injectable({
  providedIn: 'root'
})
export class PluginLifecycleObserverService {
  // EventSystemのリスナーを解除するための参照
  private listener: any = null;
  // 各GameObjectのidentifierに対応するSubjectを保持するMap
  // SubjectはObservableとしてイベントを放出し、外部からnext/completeできる
  private subjects: Map<string, { add: Subject<GameObject>, update: Subject<GameObject>, delete: Subject<GameObject | null> }> = new Map();

  constructor(private ngZone: NgZone) {
    this.initialize();
  }

  /**
   * サービス初期化時にEventSystemにグローバルリスナーを登録します。
   * これにより、全てのGameObjectのライフサイクルイベントを捕捉できます。
   */
  private initialize(): void {
    // サービスはシングルトンであるため、一度だけリスナーを登録すれば良い
    this.listener = EventSystem.register(this)
      .on('ADD_GAME_OBJECT', event => {
        // イベントデータからGameObjectのidentifierを取得
        const identifier = event.data.identifier;
        // 該当するidentifierのSubjectが存在すれば、イベントを放出
        const subject = this.subjects.get(identifier);
        if (subject) {
          // ObjectStoreから最新のGameObjectインスタンスを取得
          const gameObject = ObjectStore.instance.get(identifier);
          // Angularの変更検知をトリガーするためngZone.run内で実行
          this.ngZone.run(() => subject.add.next(gameObject));
        }
      })
      .on('UPDATE_GAME_OBJECT', event => {
        const identifier = event.data.identifier;
        const subject = this.subjects.get(identifier);
        if (subject) {
          const gameObject = ObjectStore.instance.get(identifier);
          this.ngZone.run(() => subject.update.next(gameObject));
        }
      })
      .on('DELETE_GAME_OBJECT', event => {
        const identifier = event.data.identifier;
        const subject = this.subjects.get(identifier);
        if (subject) {
          this.ngZone.run(() => {
            // 削除イベントではGameObjectインスタンスは取得できないためnullを放出
            subject.delete.next(null);
            // オブジェクトが削除されたら、そのオブジェクトに関する購読を終了
            subject.add.complete();
            subject.update.complete();
            subject.delete.complete();
            // Mapからもエントリを削除し、メモリリークを防ぐ
            this.subjects.delete(identifier);
          });
        }
      });
  }

  /**
   * 指定されたGameObjectのライフサイクルイベントを監視するためのObservable群を取得します。
   *
   * @param identifier 監視したいGameObjectのidentifier。
   * @returns GameObjectの追加、更新、削除イベントをそれぞれ放出するObservableを含むオブジェクト。
   *          - `add$`: GameObjectがObjectStoreに追加された時に、そのGameObjectインスタンスを放出します。
   *          - `update$`: GameObjectが更新された時に、そのGameObjectインスタンスを放出します。
   *          - `delete$`: GameObjectがObjectStoreから削除された時に、nullを放出します。
   *                      このObservableは、削除イベントの放出後に完了します。
   */
  observe(identifier: string): LifecycleEvents {
    // 指定されたidentifierのSubjectがまだ存在しない場合は新しく作成
    if (!this.subjects.has(identifier)) {
      this.subjects.set(identifier, {
        add: new Subject<GameObject>(),
        update: new Subject<GameObject>(),
        delete: new Subject<GameObject | null>()
      });
    }
    // 該当するSubjectからObservableを生成して返す
    const subject = this.subjects.get(identifier);
    return {
      add$: subject.add.asObservable(),
      update$: subject.update.asObservable(),
      delete$: subject.delete.asObservable()
    };
  }
}
