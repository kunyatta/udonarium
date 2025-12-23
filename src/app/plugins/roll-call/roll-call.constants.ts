export const PLUGIN_ID = 'roll-call';
export const VOTE_ID = 'plugin-roll-call-vote-shared';

export const ROLL_CALL_UI_DEFAULTS = {
  CONTROL: { // 管理パネル
    width: 300,
    height: 400,
    title: '点呼/投票管理'
  },
  ANSWER: { // 回答パネル
    width: 300,
    height: 300, // 回答専用なので少し小さめ
    title: '点呼/投票進行中'
  }
};
