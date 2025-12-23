import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { GameCharacter } from '@udonarium/game-character';
import { ImageFile } from '@udonarium/core/file-storage/image-file';
import { ObjectStore } from '@udonarium/core/synchronize-object/object-store';
import { EventSystem } from '@udonarium/core/system';
import { Observable, Subject, of, BehaviorSubject } from 'rxjs';
import { map, switchMap, takeUntil, startWith, filter } from 'rxjs/operators';
import { ReactiveImageService } from '../service/reactive-image.service';

interface CharacterViewModel {
  identifier: string;
  name: string;
  image$: Observable<ImageFile>;
}

@Component({
  selector: 'app-character-image-viewer',
  templateUrl: './character-image-viewer.component.html',
  styleUrls: ['./character-image-viewer.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CharacterImageViewerComponent implements OnInit, OnDestroy {

  gameCharacters$: Observable<GameCharacter[]>;
  selectedCharacterIdentifiers: string[] = [];
  
  characterViewModels: CharacterViewModel[] = [];

  private destroy$ = new Subject<void>();
  private _gameCharacters$ = new BehaviorSubject<GameCharacter[]>([]);
  private imageUpdate$ = new Subject<string>(); // Emits character identifier when its image might have updated

  constructor(
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
      .on('UPDATE_GAME_OBJECT', event => { // Add this listener
        if (this.selectedCharacterIdentifiers.includes(event.data.identifier)) {
          this.imageUpdate$.next(event.data.identifier);
        }
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
        startWith(char.identifier), // Emit initial identifier to trigger initial image load
        filter(identifier => identifier === char.identifier), // Only react to updates for this character
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