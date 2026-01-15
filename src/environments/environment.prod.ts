import { CombatFlowModule } from '../app/plugins/combat-flow/combat-flow.module';
import { ChatLogManagerModule } from '../app/plugins/chat-log-manager/chat-log-manager.module';
import { RollCallModule } from '../app/plugins/roll-call/roll-call.module';
import { SimpleAlarmModule } from '../app/plugins/simple-alarm/simple-alarm.module';
import { CutInModule } from '../app/plugins/cut-in/cut-in.module';
import { DynamicStandPluginModule } from '../app/plugins/dynamic-stand/dynamic-stand.module';
import { RollResultChartModule } from '../app/plugins/roll-result-chart/roll-result-chart.module';
import { TargetSelectorModule } from '../app/plugins/target-selector/target-selector.module';
import { LogoutModule } from '../app/plugins/logout/logout.module';
import { SettingsModule } from '../app/plugins/settings/settings.module';
import { ChatMessageActionModule } from '../app/plugins/chat-message-action/chat-message-action.module';

export const environment = {
  production: true,
  pluginModules: [
    SettingsModule,
    CombatFlowModule,
    ChatLogManagerModule,
    RollCallModule,
    SimpleAlarmModule,
    CutInModule,
    DynamicStandPluginModule,
    RollResultChartModule,
    TargetSelectorModule,
    ChatMessageActionModule,
    LogoutModule
  ]
};
