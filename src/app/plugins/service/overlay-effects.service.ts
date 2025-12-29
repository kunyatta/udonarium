import { Injectable } from '@angular/core';
import { OverlayObject } from '../overlay-object';

// Note: This service is deprecated and no longer used.
// Logic has been moved to CSS Transitions in OverlayComponent.
// Keeping class definition to avoid breaking imports in other files during refactoring.

@Injectable({
  providedIn: 'root'
})
export class OverlayEffectsService {
  constructor() {}
}
