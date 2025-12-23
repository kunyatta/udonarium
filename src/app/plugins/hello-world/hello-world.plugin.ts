import { Injectable } from '@angular/core';
import { IPlugin } from '../i-plugin';

@Injectable({
  providedIn: 'root'
})
export class HelloWorldPlugin implements IPlugin {
  readonly pluginName: string = 'HelloWorldPlugin';

  constructor() {
    console.log(`${this.pluginName}: Constructed`);
  }

  initialize(): void {
    console.log(`${this.pluginName}: Initialized`);
  }
}
