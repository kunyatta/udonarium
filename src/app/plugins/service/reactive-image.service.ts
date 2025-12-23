import { Injectable } from '@angular/core';
import { EventSystem } from '@udonarium/core/system';
import { ImageFile } from '@udonarium/core/file-storage/image-file';
import { ImageStorage } from '@udonarium/core/file-storage/image-storage';
import { Observable, ReplaySubject, distinctUntilChanged, filter, map, startWith, switchMap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ReactiveImageService {

  // ファイル関連のイベントが発生したことを通知するトリガー
  private fileEvent$ = new ReplaySubject<void>(1);

  constructor() {
    // ファイルリストの同期やリソースの更新イベントを監視し、トリガーを発行する
    EventSystem.register(this)
      .on('SYNCHRONIZE_FILE_LIST', () => this.fileEvent$.next())
      .on('UPDATE_FILE_RESOURE', () => this.fileEvent$.next());
    
    // サービス初期化時にも一度トリガーを発行
    this.fileEvent$.next();
  }

  /**
   * 指定した識別子を持つ ImageFile の変更を監視する Observable を生成します。
   * @param identifier 監視対象の ImageFile の識別子
   * @returns ImageFile または null を放出する Observable
   */
  observe(identifier: string): Observable<ImageFile | null> {
    return this.fileEvent$.pipe(
      // イベントが発生するたびに、最新の ImageFile を ImageStorage から取得する
      map(() => ImageStorage.instance.get(identifier)),
      // 最初に現在の状態を即時評価
      startWith(ImageStorage.instance.get(identifier)),
      // 連続して同じ内容が流れてきた場合は無視する (urlが変わった時だけ通知)
      distinctUntilChanged((prev, curr) => prev?.url === curr?.url),
    );
  }
}
