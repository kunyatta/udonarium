import { CombatFlowModule } from '../app/plugins/combat-flow/combat-flow.module';
import { ChatLogManagerModule } from '../app/plugins/chat-log-manager/chat-log-manager.module';
import { RollCallModule } from '../app/plugins/roll-call/roll-call.module';
import { SimpleAlarmModule } from '../app/plugins/simple-alarm/simple-alarm.module';
import { CutInModule } from '../app/plugins/cut-in/cut-in.module';
import { DynamicStandPluginModule } from '../app/plugins/dynamic-stand/dynamic-stand.module';
import { RollResultChartModule } from '../app/plugins/roll-result-chart/roll-result-chart.module';
import { LogoutModule } from '../app/plugins/logout/logout.module';

export const environment = {
  production: true,
  pluginModules: [
    CombatFlowModule,
    ChatLogManagerModule,
    RollCallModule,
    SimpleAlarmModule,
    CutInModule,
    DynamicStandPluginModule,
    RollResultChartModule,
    LogoutModule
  ]
};
