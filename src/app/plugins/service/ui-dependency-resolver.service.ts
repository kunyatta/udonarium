import { Injectable } from '@angular/core';
import { combineLatest, Observable, isObservable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * UIテンプレートで利用するための、複数の非同期な依存関係（Observable）を解決するためのサービス。
 * 
 * Angularのテンプレート内で複数の `async` パイプを使用すると、それぞれのObservableが解決するタイミングのズレにより、
 * UIの表示が一瞬崩れたり、意図しない挙動をすることがある。
 * 
 * このサービスは、テンプレートで必要となる複数のObservableを単一のObservableにまとめることで、
 * すべてのデータが揃ったタイミングで一度だけUIを更新することを保証し、タイミング問題を解決する。
 * 
 * @example
 * // component.ts
 * export class MyComponent implements OnInit {
 *   // テンプレートで利用する最終的なデータ$
 *   viewData$: Observable<{ user: User, settings: Settings }>;
 * 
 *   constructor(
 *     private uiResolver: UiDependencyResolverService,
 *     private userService: UserService,
 *     private settingsService: SettingsService
 *   ) {}
 * 
 *   ngOnInit() {
 *     this.viewData$ = this.uiResolver.resolve({
 *       user: this.userService.currentUser$,
 *       settings: this.settingsService.userSettings$
 *     });
 *   }
 * }
 * 
 * // component.html
 * <ng-container *ngIf="viewData$ | async as data">
 *   <h1>{{ data.user.name }}</h1>
 *   <p>Theme: {{ data.settings.theme }}</p>
 * </ng-container>
 */
@Injectable({
  providedIn: 'root'
})
export class UiDependencyResolverService {

  constructor() { }

  /**
   * キーが文字列、値がObservableであるオブジェクトを受け取り、すべてのObservableが解決された値を
   * 同じキー構造のオブジェクトとして発行する、単一のObservableを返す。
   * 
   * @template T - 依存関係オブジェクトの型。{ [key: string]: Observable<any> } 形式。
   * @param dependencies - 解決したいObservableを値として持つオブジェクト。
   * @returns すべての依存関係が解決された最終的なデータオブジェクトを発行するObservable。
   */
  resolve<T extends { [key: string]: Observable<any> }>(
    dependencies: T
  ): Observable<{ [K in keyof T]: T[K] extends Observable<infer U> ? U : never }> {
    
    const keys = Object.keys(dependencies);
    const observables = Object.values(dependencies);

    if (observables.length === 0) {
      return new Observable(subscriber => {
        subscriber.next({} as any);
        subscriber.complete();
      });
    }

    return combineLatest(observables).pipe(
      map(values => {
        const result = {} as { [K in keyof T]: T[K] extends Observable<infer U> ? U : never };
        keys.forEach((key, index) => {
          result[key as keyof T] = values[index];
        });
        return result;
      })
    );
  }
}
