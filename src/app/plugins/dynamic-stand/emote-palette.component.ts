import { Component, OnInit } from '@angular/core';
import { EmoteManagerService, EmoteData } from './emote-manager.service';
import { UIExtensionService } from '../service/ui-extension.service';

@Component({
  selector: 'emote-palette',
  templateUrl: './emote-palette.component.html',
  styleUrls: ['./emote-palette.component.css']
})
export class EmotePaletteComponent implements OnInit {

  get emotes(): EmoteData[] {
    return this.emoteManager.getEmotes();
  }

  constructor(
    private emoteManager: EmoteManagerService,
    private uiExtension: UIExtensionService
  ) { }

  ngOnInit(): void {
  }

  selectEmote(emote: EmoteData) {
    const context = this.uiExtension.activeContext;
    if (context && context.component && typeof context.component.insertEmote === 'function') {
      context.component.insertEmote(emote.icon);
    }
    this.uiExtension.closeCustomUI();
  }

  pinEmote(event: MouseEvent, emote: EmoteData) {
    event.preventDefault();
    this.emoteManager.pinEmote(emote.identifier);
  }
}