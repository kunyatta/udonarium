import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, OnDestroy, OnInit } from '@angular/core';
import { EventSystem } from '@udonarium/core/system';
import { DataElement } from '@udonarium/data-element';
// ----- MODIFICATION START (kunyatta) for DynamicStandPlugin -----
import { ModalService } from 'service/modal.service';
import { FileSelecterComponent } from 'component/file-selecter/file-selecter.component';
import { ImageStorage } from '@udonarium/core/file-storage/image-storage';
import { ImageFile } from '@udonarium/core/file-storage/image-file';
// ----- MODIFICATION END (kunyatta) for DynamicStandPlugin -----

@Component({
  selector: 'game-data-element, [game-data-element]',
  templateUrl: './game-data-element.component.html',
  styleUrls: ['./game-data-element.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GameDataElementComponent implements OnInit, OnChanges, OnDestroy {
  @Input() gameDataElement: DataElement = null;
  @Input() isEdit: boolean = false;
  @Input() isTagLocked: boolean = false;
  @Input() isValueLocked: boolean = false;

  private _name: string = '';
  get name(): string { return this._name; }
  set name(name: string) { this._name = name; this.setUpdateTimer(); }

  private _value: number | string = 0;
  get value(): number | string { return this._value; }
  set value(value: number | string) { this._value = value; this.setUpdateTimer(); }

  private _currentValue: number | string = 0;
  get currentValue(): number | string { return this._currentValue; }
  set currentValue(currentValue: number | string) { this._currentValue = currentValue; this.setUpdateTimer(); }

  private updateTimer: NodeJS.Timeout = null;

  constructor(
    private changeDetector: ChangeDetectorRef,
    // ----- MODIFICATION START (kunyatta) for DynamicStandPlugin -----
    private modalService: ModalService
    // ----- MODIFICATION END (kunyatta) for DynamicStandPlugin -----
  ) { }

  ngOnInit() {
    if (this.gameDataElement) this.setValues(this.gameDataElement);
  }

  ngOnChanges(): void {
    EventSystem.unregister(this);
    EventSystem.register(this)
      .on(`UPDATE_GAME_OBJECT/identifier/${this.gameDataElement?.identifier}`, event => {
        this.setValues(this.gameDataElement);
        this.changeDetector.markForCheck();
      })
      .on('DELETE_GAME_OBJECT', event => {
        if (this.gameDataElement && this.gameDataElement.identifier === event.data.identifier) {
          this.changeDetector.markForCheck();
        }
      });
  }

  ngOnDestroy() {
    EventSystem.unregister(this);
  }

  addElement() {
    this.gameDataElement.appendChild(DataElement.create('タグ', '', {}));
  }

  deleteElement() {
    this.gameDataElement.destroy();
  }

  upElement() {
    let parentElement = this.gameDataElement.parent;
    let index: number = parentElement.children.indexOf(this.gameDataElement);
    if (0 < index) {
      let prevElement = parentElement.children[index - 1];
      parentElement.insertBefore(this.gameDataElement, prevElement);
    }
  }

  downElement() {
    let parentElement = this.gameDataElement.parent;
    let index: number = parentElement.children.indexOf(this.gameDataElement);
    if (index < parentElement.children.length - 1) {
      let nextElement = parentElement.children[index + 1];
      parentElement.insertBefore(nextElement, this.gameDataElement);
    }
  }

  setElementType(type: string) {
    this.gameDataElement.setAttribute('type', type);
  }

  // ----- MODIFICATION START (kunyatta) for DynamicStandPlugin -----
  openModal() {
    this.modalService.open<string>(FileSelecterComponent, { isAllowedEmpty: true }).then(value => {
      if (!this.gameDataElement || value == null) return;
      this.gameDataElement.value = value;
      this.setValues(this.gameDataElement);
      this.changeDetector.markForCheck();
    });
  }

  get imageFile(): ImageFile {
    if (!this.gameDataElement || this.gameDataElement.type !== 'imageIdentifier') return ImageFile.Empty;
    const file = ImageStorage.instance.get(<string>this.gameDataElement.value);
    return file ? file : ImageFile.Empty;
  }
  // ----- MODIFICATION END (kunyatta) for DynamicStandPlugin -----

  private setValues(object: DataElement) {
    this._name = object.name;
    this._currentValue = object.currentValue;
    this._value = object.value;
  }

  private setUpdateTimer() {
    clearTimeout(this.updateTimer);
    this.updateTimer = setTimeout(() => {
      if (this.gameDataElement.name !== this.name) this.gameDataElement.name = this.name;
      if (this.gameDataElement.currentValue !== this.currentValue) this.gameDataElement.currentValue = this.currentValue;
      if (this.gameDataElement.value !== this.value) this.gameDataElement.value = this.value;
      this.updateTimer = null;
    }, 66);
  }
}