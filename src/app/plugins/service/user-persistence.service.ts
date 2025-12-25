import { Injectable } from '@angular/core';
import { PeerCursor } from '@udonarium/peer-cursor';
import { ImageStorage } from '@udonarium/core/file-storage/image-storage';
import { ImageFile, ImageState } from '@udonarium/core/file-storage/image-file';
import { EventSystem } from '@udonarium/core/system';
import * as localForage from 'localforage';

const STORE_KEYS = {
  NAME: 'udonarium_user_name',
  COLOR: 'udonarium_user_color',
  ICON_BLOB: 'udonarium_user_icon_blob',
  ICON_ID: 'udonarium_user_icon_id'
};

@Injectable({
  providedIn: 'root'
})
export class UserPersistenceService {
  private isInitialized = false;

  constructor() {
    // IndexedDBの設定
    localForage.config({
      name: 'Udonarium_UserPersistence',
      storeName: 'user_settings'
    });
  }

  /**
   * 永続化機能を開始する
   * PeerCursor.myCursor が作成された後に呼び出すこと
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    // 復元
    await this.restoreIdentity();

    // 変更監視の開始
    this.startObserving();
    
    this.isInitialized = true;
    console.log('UserPersistenceService: Initialized.');
  }

  private async restoreIdentity(): Promise<void> {
    const myCursor = PeerCursor.myCursor;
    if (!myCursor) return;

    try {
      // 名前と色の復元
      const savedName = await localForage.getItem<string>(STORE_KEYS.NAME);
      const savedColor = await localForage.getItem<string>(STORE_KEYS.COLOR);

      myCursor.name = savedName ? savedName : 'プレイヤー';
      if (savedColor) myCursor.color = savedColor;

      // アイコンの復元
      const iconBlob = await localForage.getItem<Blob>(STORE_KEYS.ICON_BLOB);
      const iconId = await localForage.getItem<string>(STORE_KEYS.ICON_ID);

      if (iconBlob && iconId) {
        console.log('UserPersistenceService: Restoring user icon...', iconId);
        // BlobからImageFileを再生成してStorageに登録
        const imageFile = ImageStorage.instance.add({
          identifier: iconId,
          name: iconId,
          type: iconBlob.type,
          blob: iconBlob,
          url: '',
          thumbnail: {
            blob: iconBlob,
            type: iconBlob.type,
            url: ''
          }
        });
        if (imageFile) {
          myCursor.imageIdentifier = imageFile.identifier;
        }
      } else {
        // 保存されたアイコンがない場合はデフォルトアイコン
        myCursor.imageIdentifier = 'none_icon';
      }
    } catch (e) {
      console.error('UserPersistenceService: Failed to restore identity.', e);
    }
  }

  private startObserving(): void {
    // UPDATE_GAME_OBJECT イベントを監視して、myCursor の変更を保存する
    EventSystem.register(this)
      .on('UPDATE_GAME_OBJECT', async (event) => {
        const myCursor = PeerCursor.myCursor;
        if (!myCursor || event.data.identifier !== myCursor.identifier) return;

        // 変更されたプロパティを保存
        // (効率のため、常に全項目チェックして保存する)
        await this.saveIdentity(myCursor);
      });
  }

  private async saveIdentity(myCursor: PeerCursor): Promise<void> {
    try {
      await localForage.setItem(STORE_KEYS.NAME, myCursor.name);
      await localForage.setItem(STORE_KEYS.COLOR, myCursor.color);

      // アイコンの保存
      const image = myCursor.image;
      if (image && image.identifier !== 'none_icon' && image.state === ImageState.COMPLETE) {
        // Blobがある場合のみ保存
        if (image.blob) {
          await localForage.setItem(STORE_KEYS.ICON_BLOB, image.blob);
          await localForage.setItem(STORE_KEYS.ICON_ID, image.identifier);
        }
      } else if (myCursor.imageIdentifier === 'none_icon') {
        await localForage.removeItem(STORE_KEYS.ICON_BLOB);
        await localForage.removeItem(STORE_KEYS.ICON_ID);
      }
    } catch (e) {
      console.error('UserPersistenceService: Failed to save identity.', e);
    }
  }
}
