import { Component, OnInit, OnDestroy, NgZone, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { EventSystem } from '@udonarium/core/system';
import { Subject } from 'rxjs';
import { PluginDataContainer } from '../../class/plugin-data-container';
import { PluginHelperService } from '../service/plugin-helper.service';
import { TurnBasedEngineService } from '../service/turn-based-engine.service';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { GameCharacter } from '@udonarium/game-character';

@Component({
  selector: 'app-turn-engine-test',
  templateUrl: './turn-engine-test.component.html',
  styleUrls: ['./turn-engine-test.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TurnEngineTestComponent implements OnInit, OnDestroy {

  private destroy$ = new Subject<void>();
  private container: PluginDataContainer | null = null;
  
  participantInput: string = '';

  participantIds: string[] = [];
  currentIndex: number = 0;
  round: number = 1;
  isPlaying: boolean = false;
  
  get characters(): GameCharacter[] {
    return ObjectStore.instance.getObjects(GameCharacter);
  }

  constructor(
    private ngZone: NgZone,
    private changeDetectorRef: ChangeDetectorRef,
    private pluginHelper: PluginHelperService,
    private turnEngine: TurnBasedEngineService
  ) { }

  ngOnInit(): void {
    this.container = this.pluginHelper.getOrCreateContainer('TurnEngineTestPlugin', 'TurnEngineTest');
    
    // 初回ロード時と、コンテナが更新されたときにUIを更新
    this.updateUiFromContainer();

    EventSystem.register(this)
      .on('UPDATE_GAME_OBJECT', event => {
        // 自分のコンテナ、またはその子要素が更新された場合にUIを更新
        if (this.pluginHelper.isRelated(this.container, event.data.identifier)) {
          this.ngZone.run(() => {
            this.updateUiFromContainer();
          });
        }
      })
      .on('XML_LOADED', () => {
        this.ngZone.run(() => {
          // ルームデータロード後、コンテナの参照が新しくなる可能性があるので再取得
          this.container = this.pluginHelper.getOrCreateContainer('TurnEngineTestPlugin', 'TurnEngineTest');
          this.updateUiFromContainer();
        });
      });
  }

  ngOnDestroy(): void {
    EventSystem.unregister(this);
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updateUiFromContainer(): void {
    if (!this.container) return;

    const engineRoot = this.turnEngine['findOrCreateEngineRoot'](this.container); // privateメソッドにアクセス
    const idsRoot = this.turnEngine['findOrCreateIdsRoot'](this.container);     // privateメソッドにアクセス

    this.isPlaying = engineRoot.getFirstElementByName('isPlaying')?.value === 'true';
    this.currentIndex = Number(engineRoot.getFirstElementByName('currentIndex')?.value) || 0;
    this.round = Number(engineRoot.getFirstElementByName('round')?.value) || 1;
    this.participantIds = idsRoot.children.map(el => el.value as string);
    
    this.changeDetectorRef.markForCheck();
  }

  addParticipant(): void {
    if (!this.container || !this.participantInput) return;
    this.turnEngine.addParticipant(this.container, this.participantInput);
    this.participantInput = ''; // 入力フィールドをクリア
    this.updateUiFromContainer();
  }

  addCharacterToParticipant(character: GameCharacter): void {
    if (!this.container || !character) return;
    this.turnEngine.addParticipant(this.container, character.identifier);
    this.updateUiFromContainer();
  }

  removeParticipant(id: string): void {
    if (!this.container) return;
    this.turnEngine.removeParticipant(this.container, id);
    this.updateUiFromContainer();
  }

  startTurn(): void {
    if (!this.container) return;
    this.turnEngine.start(this.container);
    this.updateUiFromContainer();
  }

  nextTurn(): void {
    if (!this.container) return;
    this.turnEngine.nextTurn(this.container);
    this.updateUiFromContainer();
  }

  stopTurn(): void {
    if (!this.container) return;
    this.turnEngine.stop(this.container);
    this.updateUiFromContainer();
  }

  resetTurn(): void {
    if (!this.container) return;
    this.turnEngine.reset(this.container);
    this.updateUiFromContainer();
  }

  getCharacterName(id: string): string {
    const object = ObjectStore.instance.get(id);
    if (object instanceof GameCharacter) {
      return object.name;
    }
    return 'IDのみ: ' + id;
  }
}