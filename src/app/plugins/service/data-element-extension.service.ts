import { Injectable, Type } from '@angular/core';

export interface DataElementExtension {
  type: string;
  component: Type<any>;
  isImage?: boolean; // If true, SaveDataService will collect image from value
  label?: string;    // Label for type selector
}

@Injectable({
  providedIn: 'root'
})
export class DataElementExtensionService {
  private extensions = new Map<string, DataElementExtension>();

  constructor() { }

  register(extension: DataElementExtension) {
    this.extensions.set(extension.type, extension);
  }

  get(type: string): DataElementExtension | undefined {
    return this.extensions.get(type);
  }

  getAll(): DataElementExtension[] {
    return Array.from(this.extensions.values());
  }

  isImage(type: string): boolean {
    return this.extensions.get(type)?.isImage ?? false;
  }
}
