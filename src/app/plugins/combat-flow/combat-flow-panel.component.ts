import { Component, OnInit, OnDestroy, NgZone, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { PanelService } from '../../service/panel.service';
import { CombatStateService } from './combat-state.service';
import { BehaviorSubject, Observable, combineLatest, of } from 'rxjs';
import { map, switchMap, startWith, take } from 'rxjs/operators';
import { GameCharacter } from '@udonarium/game-character';
import { ImageFile } from '@udonarium/core/file-storage/image-file';
import { Combatant } from './combatant.model';
import { ReactiveImageService } from '../service/reactive-image.service';
import { CharacterDataService } from '../service/character-data.service';
import { DataElement } from '@udonarium/data-element';
import { EventSystem } from '@udonarium/core/system';
import { ContextMenuService, ContextMenuAction } from 'service/context-menu.service';
import { PluginUiService } from '../service/plugin-ui.service';
import { CombatFlowControllerComponent } from './combat-flow-controller.component';
import { COMBAT_FLOW_UI_DEFAULTS } from './combat-flow.plugin';
import { GameCharacterSheetComponent } from 'component/game-character-sheet/game-character-sheet.component';
import { ChatPaletteComponent } from 'component/chat-palette/chat-palette.component';
import { ActiveStatusEffect, StatusEffect, VisualEffect } from './status-effect.model';

interface CombatantViewModel {
  combatant: Combatant;
  character: GameCharacter;
  image$: Observable<ImageFile | null>;
  parameters: DataElement[]; // 表示用パラメータ
  isCurrentTurn: boolean;
  activeStatusEffects: ActiveStatusEffect[]; // 追加
}

@Component({
  selector: 'app-combat-flow-panel',
  templateUrl: './combat-flow-panel.component.html',
  styleUrls: ['./combat-flow-panel.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CombatFlowPanelComponent implements OnInit, OnDestroy {
  
  readonly isCombat$ = this.combatStateService.isCombat$;
  readonly round$ = this.combatStateService.round$;
  readonly viewModels$: Observable<CombatantViewModel[]>;
  readonly currentIndex$ = this.combatStateService.currentIndex$;

  private displayedCharacterIds: Set<string> = new Set();
  private refreshTrigger$ = new BehaviorSubject<void>(undefined); // 強制更新用トリガー

  constructor(
    private panelService: PanelService,
    private combatStateService: CombatStateService,
    private reactiveImageService: ReactiveImageService,
    private characterDataService: CharacterDataService,
    private changeDetectorRef: ChangeDetectorRef,
    private ngZone: NgZone,
    private contextMenuService: ContextMenuService,
    private pluginUiService: PluginUiService
  ) {
    this.viewModels$ = combineLatest([
      this.combatStateService.combatants$,
      this.combatStateService.displayDataTags$,
      this.combatStateService.currentCharacterId$,
      this.refreshTrigger$
    ]).pipe(
      switchMap(([combatants, displayDataTags, currentCharacterId, _]) => {
        if (!combatants || combatants.length === 0) {
          return of([]);
        }
        return combineLatest(combatants.map(combatant => 
          this.createViewModel(combatant, displayDataTags, currentCharacterId)
        ));
      }),
      map(vms => {
        const validVms = vms.filter(vm => vm != null);
        // 表示中のキャラクターIDリストを更新（変更検知用）
        this.displayedCharacterIds = new Set(validVms.map(vm => vm.character.identifier));
        return validVms;
      }) 
    );
  }

  ngOnInit(): void {
    // キャラクターのパラメータ変更を検知して表示を更新する
    EventSystem.register(this)
      .on('UPDATE_GAME_OBJECT', event => {
        const identifier = event.data.identifier;
        
        // キャラクタ自体の更新
        if (this.displayedCharacterIds.has(identifier)) {
          this.ngZone.run(() => this.refreshTrigger$.next());
          return;
        }

        // パラメータ(DataElement)の更新
        // ActiveStatusEffectもDataElementとして保存されるため、ここでキャッチできる
        if (event.data.aliasName === 'data') {
           this.ngZone.run(() => this.refreshTrigger$.next());
        }
      })
      .on('ADD_GAME_OBJECT', event => {
        const identifier = event.data.identifier;
        // DataElementの追加を検知
        if (event.data.aliasName === 'data') {
           this.ngZone.run(() => this.refreshTrigger$.next());
        }
      });
  }

  ngOnDestroy(): void {
    EventSystem.unregister(this);
  }

  private createViewModel(combatant: Combatant, displayDataTags: string, currentCharacterId: string | null): Observable<CombatantViewModel | null> {
    const character = this.characterDataService.getGameCharacter(combatant.characterId);
    if (!character) {
      return of(null);
    }

    const imageIdentifier = character.imageFile?.identifier ?? '';
    const image$ = imageIdentifier ? this.reactiveImageService.observe(imageIdentifier) : of(null);
    
    // パラメータをCharacterDataService経由で取得
    const parameters = this.characterDataService.getParameters(character, displayDataTags);
    
    // ステータス効果を取得
    const activeStatusEffects = this.getActiveStatusEffects(character.identifier);

    return of({
      combatant: combatant,
      character: character,
      image$: image$,
      parameters: parameters,
      isCurrentTurn: combatant.characterId === currentCharacterId,
      activeStatusEffects: activeStatusEffects
    });
  }

  // --- Status Effects ---

  getActiveStatusEffects(characterIdentifier: string): ActiveStatusEffect[] {
    return this.combatStateService.getActiveStatusEffects(characterIdentifier);
  }

  getCombinedCardNgStyle(effects: ActiveStatusEffect[]): { [key: string]: string } {
    let style: { [key: string]: string } = {};
    let filterValue = '';
    let backgroundColor = '';
    let auraColor = '';

    // 効果を走査してスタイルを合成
    // 複数の効果がある場合、後勝ちにするか合成するか？
    // filterは合成可能 (e.g. "grayscale(100%) blur(3px)")
    // color系は後勝ちにするのが一般的だが、重ね合わせは難しい
    
    for (const effect of effects) {
      for (const ve of effect.visualEffects) {
        if (ve.type === 'filter') {
          filterValue += ` ${ve.value}`;
        } else if (ve.type === 'backgroundColor') {
          backgroundColor = ve.value;
        } else if (ve.type === 'aura') {
          auraColor = ve.value;
        }
      }
    }

    if (filterValue) {
      style['filter'] = filterValue.trim();
    }
    if (backgroundColor) {
      style['background-color'] = backgroundColor;
    }
    if (auraColor) {
      style['box-shadow'] = `0 0 10px 2px ${auraColor}`;
    }

    return style;
  }

  getResourcePercentage(param: DataElement): number {
    // DataElementのプロパティに直接アクセス
    // (型定義にない場合は any キャストが必要だが、実行時はプロパティとして存在する)
    const max = Number((param as any).value);
    const current = Number((param as any).currentValue);
    
    if (isNaN(max) || isNaN(current) || max <= 0) return 0;
    return (current / max) * 100;
  }

  getParameterType(param: DataElement): string {
    return param.getAttribute('type');
  }
  
  // 戦闘終了ボタンはコントローラーから操作されるため、パネル側では直接呼び出さない
  toggleCombat(): void {
    this.combatStateService.endCombat();
  }

  getCharacterName(characterId: string): string {
    const char = this.characterDataService.getGameCharacter(characterId);
    return char ? char.name : 'Unknown';
  }

  // --- User Actions ---

  onClickCharacter(combatant: Combatant): void {
    this.combatStateService.setTurnToCharacter(combatant.characterId);
  }

  onDoubleClickCharacter(combatant: Combatant): void {
    this.combatStateService.toggleHasActed(combatant.characterId);
  }

  onRightClickCharacter(event: MouseEvent, combatant: Combatant): void {
    event.stopPropagation();
    event.preventDefault();

    const character = this.characterDataService.getGameCharacter(combatant.characterId);
    if (!character) return;

    const clickX = event.pageX;
    const clickY = event.pageY;

    const actions: ContextMenuAction[] = [
      {
        name: '戦闘コントローラを開く',
        action: () => {
          this.pluginUiService.openAtCursor(CombatFlowControllerComponent, { 
            isSingleton: false,
            width: COMBAT_FLOW_UI_DEFAULTS.CONTROLLER.width,
            height: COMBAT_FLOW_UI_DEFAULTS.CONTROLLER.height,
            title: COMBAT_FLOW_UI_DEFAULTS.CONTROLLER.title,
            inputs: { initialCasterIdentifier: character.identifier }
          });
        }
      },
      {
        name: 'キャラクターシートを表示',
        action: () => {
          // 中央に表示
          const width = 700;
          const height = 800;
          const left = (window.innerWidth / 2) - (width / 2);
          const top = (window.innerHeight / 2) - (height / 2);
          
          const panel = this.panelService.open(GameCharacterSheetComponent, { 
            width, height, left, top,
            title: 'キャラクターシート'
          });
          panel.tabletopObject = character;
        }
      },
      {
        name: 'チャットパレットを表示',
        action: () => {
          // 中央に表示
          const width = 600;
          const height = 400;
          const left = (window.innerWidth / 2) - (width / 2);
          const top = (window.innerHeight / 2) - (height / 2);

          const panel = this.panelService.open(ChatPaletteComponent, { 
            width, height, left, top,
            title: 'チャットパレット'
          });
          panel.character = character;
        }
      }
    ];

    this.contextMenuService.open(
      { x: event.pageX, y: event.pageY }, 
      actions, 
      character.name
    );
  }
}