import { Injectable } from '@angular/core';
import { IPlugin } from '../i-plugin';
import { MANIFEST } from './manifest';

@Injectable({
  providedIn: 'root'
})
export class HelloWorldPlugin implements IPlugin {
  readonly manifest = MANIFEST;
  readonly pluginName = MANIFEST.id;
  readonly name = MANIFEST.name;
  readonly icon = MANIFEST.icon;

  constructor() {
    console.log(`${this.pluginName}: Constructed`);
  }

  initialize(): void {
    console.log(`${this.pluginName}: Initialized`);
  }
}
