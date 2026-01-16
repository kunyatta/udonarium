export interface ConfigItem {
  identifier: string;
  name: string;
  imageIdentifier: string;
  description: string;
}

export const DEFAULT_CONFIG_ITEM: Omit<ConfigItem, 'identifier'> = {
  name: '新規項目',
  imageIdentifier: '',
  description: ''
};
