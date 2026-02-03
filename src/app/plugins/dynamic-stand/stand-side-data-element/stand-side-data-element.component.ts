import { Component, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { DataElement } from '@udonarium/data-element';

@Component({
  selector: 'stand-side-data-element',
  templateUrl: './stand-side-data-element.component.html',
  styleUrls: ['./stand-side-data-element.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StandSideDataElementComponent {

  constructor(
    public gameDataElement: DataElement,
    private changeDetector: ChangeDetectorRef
  ) { }

  get value(): string {
    return <string>this.gameDataElement.value;
  }

  set value(value: string) {
    this.gameDataElement.value = value;
    this.changeDetector.markForCheck();
  }
}
