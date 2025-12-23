import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, NgZone } from '@angular/core';
import { EventSystem } from '@udonarium/core/system';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { PanelService } from 'service/panel.service';
import { PluginDataContainer } from '../../class/plugin-data-container';
import { ObjectXmlConverterService } from '../service/object-xml-converter.service';
import { PluginStateService } from '../service/plugin-state.service';

// カウンターの状態を表すインターフェース
export interface CounterState {
  count: number;
}

@Component({
  selector: 'app-test-panel',
  templateUrl: './test-panel.component.html',
  styleUrls: ['./test-panel.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TestPanelComponent implements OnInit, OnDestroy {

  private container: PluginDataContainer;
  private readonly initialState: CounterState = { count: 0 };
  count: number = 0;

  constructor(
    private pluginStateService: PluginStateService,
    private objectXmlConverter: ObjectXmlConverterService,
    private panelService: PanelService,
    private cd: ChangeDetectorRef,
    private ngZone: NgZone
  ) { }

  ngOnInit(): void {
    // コンポーネントの生成時に一度だけ初期化を実行する
    this.initialize();
  }

  ngOnDestroy(): void {
    // イベントリスナーを破棄
    EventSystem.unregister(this);
    console.log(`TestPlugin: ngOnDestroy called.`);
  }

  /**
   * コンポーネントの初期化処理
   */
  private initialize(): void {
    console.log(`TestPlugin: Initializing...`);
    // 既存のイベントリスナーをすべて破棄
    EventSystem.unregister(this);

    // 1. コンテナを取得
    this.container = this.pluginStateService.getContainer('test-plugin', 'counter');

    // 2. 新しいコンテナに対するイベント監視を登録
    EventSystem.register(this)
      .on('UPDATE_GAME_OBJECT', event => {
        // this.containerが未定義になる場合があるためガードを追加
        if (!this.container || event.data.identifier !== this.container.identifier) return;
        this.ngZone.run(() => {
          this.updateState();
          this.cd.markForCheck();
        });
      })
      .on('DELETE_GAME_OBJECT', event => {
        console.log('TestPlugin: DELETE_GAME_OBJECT event received for ID:', event.data.identifier);
        // 自分のコンテナが削除されたら、自分自身を閉じる
        if (this.container && event.data.identifier === this.container.identifier) {
          console.log('TestPlugin: Identifier matches! Closing panel...');
          this.panelService.close();
        }
      });

    // 3. 状態をUIに反映し、コンテナが新規作成された場合は初期値を設定
    this.initializeState();
    this.cd.markForCheck(); // UIを更新
    console.log(`TestPlugin: Initialized with container ${this.container.identifier}`);
  }

  private initializeState(): void {
    // ガードを追加
    if (!this.container) {
      console.warn('TestPlugin: initializeState called but this.container is undefined.');
      return;
    }
    const currentState = this.getCurrentState(this.container);
    if (currentState === null) {
      // コンテナが空（新規作成された）の場合、初期値を書き込む
      this.setState(this.initialState);
      this.count = this.initialState.count;
    } else {
      // 既存の値を反映
      this.count = currentState.count;
    }
  }

  private updateState(): void {
    // イベントは「合図」なので、ObjectStoreから最新のインスタンスを取り直す
    const container = ObjectStore.instance.get<PluginDataContainer>(this.container.identifier);
    if (!container) return;

    const state = this.getCurrentState(container);
    if (state) {
      this.count = state.count;
    }
  }

  private getCurrentState(container: PluginDataContainer): CounterState | null {
    // ガードを追加
    if (!container) {
      console.warn('TestPlugin: getCurrentState called with undefined container.');
      return null;
    }
    if (container.state.children.length > 0) {
      return this.objectXmlConverter.xmlToObject(container.state.children) as CounterState;
    }
    return null;
  }

  private setState(newState: CounterState): void {
    // ガードを追加
    if (!this.container) return;
    // 既存の子要素をすべて削除
    const childrenToRemove = [...this.container.state.children];
    for (const child of childrenToRemove) {
      this.container.state.removeChild(child);
    }
    // 新しい状態をXMLに変換して追加
    const newDataElements = this.objectXmlConverter.objectToXml(newState, 'state');
    newDataElements.forEach(el => this.container.state.appendChild(el));
  }

  // カウンターをインクリメントするメソッド
  increment(): void {
    // ガードを追加
    if (!this.container) {
      console.warn('TestPlugin: increment called but this.container is undefined. Cannot increment.');
      return;
    }
    const currentState = this.getCurrentState(this.container) ?? this.initialState;
    const newState: CounterState = {
      count: currentState.count + 1
    };
    this.setState(newState);
    this.container.update(); // 更新イベントを発行
  }
}
