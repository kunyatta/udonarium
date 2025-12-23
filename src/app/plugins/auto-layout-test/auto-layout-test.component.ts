import { Component, OnInit, OnDestroy, NgZone, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { GameCharacter } from '@udonarium/game-character';
import { EventSystem } from '@udonarium/core/system';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { Observable, Subject, of, BehaviorSubject } from 'rxjs';
import { map, switchMap, takeUntil, startWith, filter } from 'rxjs/operators';
import { ImageFile } from '@udonarium/core/file-storage/image-file';
import { ReactiveImageService } from '../service/reactive-image.service';

interface CharacterViewModel {
  identifier: string;
  name: string;
  image$: Observable<ImageFile | null>;
}

@Component({
  selector: 'app-auto-layout-test',
  templateUrl: './auto-layout-test.component.html',
  styleUrls: ['./auto-layout-test.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AutoLayoutTestComponent implements OnInit, OnDestroy {

  gameCharacters$: Observable<GameCharacter[]>;
  selectedCharacterIdentifiers: string[] = [];
  characterViewModels: CharacterViewModel[] = [];

  private destroy$ = new Subject<void>();
  private _gameCharacters$ = new BehaviorSubject<GameCharacter[]>([]);
  private imageUpdate$ = new Subject<string>();

  constructor(
    private ngZone: NgZone,
    private reactiveImageService: ReactiveImageService,
    private changeDetectorRef: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.gameCharacters$ = this._gameCharacters$.asObservable();
    this.updateGameCharacters();

    EventSystem.register(this)
      .on('ADD_GAME_OBJECT', event => {
        if (event.data.aliasName === GameCharacter.aliasName) {
          this.updateGameCharacters();
        }
      })
      .on('DELETE_GAME_OBJECT', event => {
        if (event.data.aliasName === GameCharacter.aliasName) {
          this.updateGameCharacters();
        }
      })
      .on('UPDATE_GAME_OBJECT', event => {
        // 選択中のキャラクターの画像が更新された場合のみ、imageUpdate$を発火
        if (this.selectedCharacterIdentifiers.includes(event.data.identifier)) {
          this.imageUpdate$.next(event.data.identifier);
        }
      })
      .on('XML_LOADED', () => {
        this.ngZone.run(() => {
          this.updateGameCharacters();
          // XMLロード後、選択中のキャラクターが削除されている可能性もあるため、選択状態を再評価
          this.selectedCharacterIdentifiers = this.selectedCharacterIdentifiers.filter(id => 
            ObjectStore.instance.get<GameCharacter>(id) != null
          );
          this.onSelectionChange(); // 選択状態を再評価してUIを更新
        });
      });
  }

  ngOnDestroy(): void {
    EventSystem.unregister(this);
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updateGameCharacters(): void {
    const characters = ObjectStore.instance.getObjects<GameCharacter>(GameCharacter);
    this._gameCharacters$.next(characters);
    this.changeDetectorRef.markForCheck();
  }

  onSelectionChange(): void {
    const selectedCharacters = this.selectedCharacterIdentifiers
      .map(id => ObjectStore.instance.get<GameCharacter>(id))
      .filter(char => char != null);

    this.characterViewModels = selectedCharacters.map(char => {
      const image$ = this.imageUpdate$.pipe(
        startWith(char.identifier), // 初回ロード時または画像変更時にIdentifierを流す
        filter(identifier => identifier === char.identifier), // このキャラクターの更新のみに反応
        switchMap(() => {
          const imageElement = char.imageDataElement;
          const imageIdentifierElement = imageElement ? imageElement.getFirstElementByName('imageIdentifier') : null;
          const imageIdentifier = imageIdentifierElement?.value ? String(imageIdentifierElement.value) : null;

          return imageIdentifier
            ? this.reactiveImageService.observe(imageIdentifier)
            : of(null);
        }),
        takeUntil(this.destroy$)
      );

      return {
        identifier: char.identifier,
        name: char.name,
        image$: image$
      };
    });
    this.changeDetectorRef.markForCheck();
  }
}