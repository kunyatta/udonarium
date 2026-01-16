import { CombatFlowModule } from '../app/plugins/combat-flow/combat-flow.module';
import { CharacterImageViewerModule } from '../app/plugins/character-image-viewer/character-image-viewer.module';
import { HelloWorldModule } from '../app/plugins/hello-world/hello-world.module';
import { AutoLayoutTestModule } from '../app/plugins/auto-layout-test/auto-layout-test.module';
import { TurnEngineTestModule } from '../app/plugins/turn-engine-test/turn-engine-test.module';
import { SimpleAlarmModule } from '../app/plugins/simple-alarm/simple-alarm.module';
import { RollCallModule } from '../app/plugins/roll-call/roll-call.module';
import { ChatLogManagerModule } from '../app/plugins/chat-log-manager/chat-log-manager.module';
import { OverlayTestPluginModule } from '../app/plugins/overlay-test-plugin/overlay-test-plugin.module';
import { CutInModule } from '../app/plugins/cut-in/cut-in.module';
import { DynamicStandPluginModule } from '../app/plugins/dynamic-stand/dynamic-stand.module';
import { LogoutModule } from '../app/plugins/logout/logout.module';
import { RollResultChartModule } from '../app/plugins/roll-result-chart/roll-result-chart.module';
import { TargetSelectorModule } from '../app/plugins/target-selector/target-selector.module';
import { SettingsModule } from '../app/plugins/settings/settings.module';
import { ChatMessageActionModule } from '../app/plugins/chat-message-action/chat-message-action.module';
import { ConfigPanelTestModule } from '../app/plugins/config-panel-test/config-panel-test.module';

export const environment = {
  production: false,
  pluginModules: [
    ConfigPanelTestModule,
    SettingsModule,
    CombatFlowModule,
    ChatLogManagerModule,
    RollCallModule,
    SimpleAlarmModule,
    CutInModule,
    CharacterImageViewerModule,
    HelloWorldModule,
    AutoLayoutTestModule,
    TurnEngineTestModule,
    OverlayTestPluginModule,
    DynamicStandPluginModule,
    RollResultChartModule,
    TargetSelectorModule,
    ChatMessageActionModule,
    LogoutModule
  ]
};
