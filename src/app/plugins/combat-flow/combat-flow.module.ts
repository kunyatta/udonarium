import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SharedModule } from '../../shared.module';
import { PLUGIN_TOKEN } from '../i-plugin';
import { CombatFlowPlugin } from './combat-flow.plugin';
import { CombatFlowPanelComponent } from './combat-flow-panel.component';
import { CombatStateService } from './combat-state.service';
import { StatusEffectDictionaryService } from './status-effect-dictionary.service';
import { DamageCheckPanelComponent } from './damage-check-panel.component'; // Import DamageCheckPanelComponent
import { CombatFlowSettingsComponent } from './combat-flow-settings.component';
import { CombatFlowHelpComponent } from './combat-flow-help.component';
import { CombatFlowControllerHelpComponent } from './combat-flow-controller-help.component';
import { BattleActionComponent } from './battle-action.component';
import { CombatFlowManagerComponent } from './combat-flow-manager.component';
import { CombatFlowManagerHelpComponent } from './combat-flow-manager-help.component';

@NgModule({
  declarations: [
    CombatFlowPanelComponent,
    DamageCheckPanelComponent, // Add DamageCheckPanelComponent to declarations
    CombatFlowSettingsComponent,
    CombatFlowHelpComponent,
    CombatFlowControllerHelpComponent,
    BattleActionComponent,
    CombatFlowManagerComponent,
    CombatFlowManagerHelpComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    SharedModule
  ],
  providers: [
    { provide: PLUGIN_TOKEN, useClass: CombatFlowPlugin, multi: true },
    CombatStateService,
    StatusEffectDictionaryService
  ],
})
export class CombatFlowModule { }
