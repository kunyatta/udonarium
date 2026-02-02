import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { DataElement } from '@udonarium/data-element';
import { ImageFile } from '@udonarium/core/file-storage/image-file';
import { ImageStorage } from '@udonarium/core/file-storage/image-storage';
import { ModalService } from 'service/modal.service';
import { FileSelecterComponent } from 'component/file-selecter/file-selecter.component';

@Component({
  selector: 'image-data-element',
  templateUrl: './image-data-element.component.html',
  styleUrls: ['./image-data-element.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ImageDataElementComponent implements OnInit {

  constructor(
    public gameDataElement: DataElement,
    private modalService: ModalService,
    private changeDetector: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
  }

  get imageFile(): ImageFile {
    if (!this.gameDataElement) return ImageFile.Empty;
    const file = ImageStorage.instance.get(<string>this.gameDataElement.value);
    return file ? file : ImageFile.Empty;
  }

  get value(): string {
    return <string>this.gameDataElement.value;
  }

  openModal() {
    this.modalService.open<string>(FileSelecterComponent, { isAllowedEmpty: true }).then(value => {
      if (!this.gameDataElement || value == null) return;
      this.gameDataElement.value = value;
      this.changeDetector.markForCheck();
    });
  }
}
