import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CharacterImageViewerComponent } from './character-image-viewer.component';

describe('CharacterImageViewerComponent', () => {
  let component: CharacterImageViewerComponent;
  let fixture: ComponentFixture<CharacterImageViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CharacterImageViewerComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CharacterImageViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
