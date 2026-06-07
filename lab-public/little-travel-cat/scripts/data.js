// 小旅猫的静态配置：存档 key、节奏数值、商店数据、路线和收集品文案。
export const SAVE_VERSION = 1;
export const SLOT_COUNT = 3;
export const ACTIVE_SLOT_KEY = 'littleTravelCatActiveSlot:v1';
export const SAVE_KEY_PREFIX = 'littleTravelCatSave:v1:slot:';
export const THEME_KEY = 'littleTravelCatTheme:v1';

export const RESOURCE_INTERVAL_MS = 60 * 1000;
export const DEV_RESOURCE_INTERVAL_MS = 5 * 1000;
export const RESOURCE_CAP = 20;
export const STARTING_DEW = 25;

// 默认真实节奏；页面运行时带 ?dev 会临时使用测试旅行时长。
export const DEV_TIME_SCALE = false;
export const DEV_HOUR_MS = 60 * 1000;
export const PROD_HOUR_MS = 60 * 60 * 1000;
export const HOUR_MS = DEV_TIME_SCALE ? DEV_HOUR_MS : PROD_HOUR_MS;
export const SOUVENIR_CHANCE = 0.45;

// 食物决定旅行时长范围；工具主要影响路线和特殊结果权重。
export const FOODS = [
  {
    id: 'dried_fish_pack',
    name: '小鱼干包',
    price: 10,
    tripHoursMin: 1,
    tripHoursMax: 2,
    description: '适合短途闲逛。',
  },
  {
    id: 'floss_rice_ball',
    name: '肉松饭团',
    price: 20,
    tripHoursMin: 2,
    tripHoursMax: 4,
    description: '适合去稍远一点的地方。',
  },
  {
    id: 'fresh_fish_bento',
    name: '鲜鱼便当',
    price: 35,
    tripHoursMin: 4,
    tripHoursMax: 8,
    description: '适合一场慢悠悠的远行。',
  },
];

export const TOOLS = [
  {
    id: 'old_map',
    name: '旧地图',
    price: 30,
    description: '更容易去远一点的地方。',
  },
  {
    id: 'small_bell',
    name: '小铃铛',
    price: 25,
    description: '更容易遇到特别的小插曲。',
  },
  {
    id: 'tiny_scarf',
    name: '小围巾',
    price: 25,
    description: '适合有风的路。',
  },
  {
    id: 'folding_mat',
    name: '折叠小垫',
    price: 20,
    description: '方便在路边睡一会儿。',
  },
  {
    id: 'glass_bottle',
    name: '小玻璃瓶',
    price: 25,
    description: '适合装一点海风或者河水。',
  },
];

// 路线 baseHours 会参与 chooseRoute 的权重计算，不是固定旅行时长。
export const ROUTES = [
  {
    id: 'near_rooftop',
    name: '近处屋顶',
    baseHours: 1,
  },
  {
    id: 'river_path',
    name: '河边小路',
    baseHours: 2,
  },
  {
    id: 'mist_forest',
    name: '雾气森林',
    baseHours: 3,
  },
  {
    id: 'old_station',
    name: '旧车站',
    baseHours: 4,
  },
  {
    id: 'sea_wall',
    name: '海边防波堤',
    baseHours: 5,
  },
  {
    id: 'snow_alley',
    name: '雪后巷子',
    baseHours: 6,
  },
];

export const HOME_LINES = [
  '小旅猫正在窗边晒太阳。',
  '小旅猫正在盯着旧地图发呆。',
  '小旅猫正在把小鱼干拨来拨去。',
  '小旅猫正在纸箱里窝着。',
  '小旅猫正在认真舔爪子。',
  '小旅猫正在假装没看见你。',
];

export const TRAVELING_LINES = [
  '猫不在家。',
  '窗台上还留着一点毛。',
  '行李少了一份便当，铃铛也不见了。',
  '它大概又去什么地方闲逛了。',
];

export const RETURNED_LINES = [
  '它回来了，看起来心情不错。',
  '它把什么东西轻轻放在门口。',
  '它叼回来一张明信片。',
  '它看了你一眼，然后先去休息了。',
];

export const POSTCARD_TITLES = [
  '《今天的风很适合晒太阳》',
  '《桥边有好多鸽子》',
  '《海风把毛吹乱了》',
  '《在旧车站睡了一会儿》',
  '《山路边捡到一片叶子》',
  '《雨天不太想赶路》',
];

export const SPECIAL_POSTCARD_TITLES = [
  '《铃声经过了无人长椅》',
  '《一阵风把午觉吹远了》',
  '《它说那里有很亮的窗》',
];

export const POSTCARD_DESCRIPTIONS = [
  '照片背面只有一行小字：这里的风很慢。',
  '它好像在桥边待了很久。',
  '明信片边角有一点潮，可能下过雨。',
  '你不确定它有没有真的看地图。',
  '它看起来只是找了个地方睡觉。',
];

export const SPECIAL_POSTCARD_DESCRIPTIONS = [
  '背面夹着一小段铃声似的字：路边有云，云边有鱼。',
  '邮戳压得很浅，像是猫爪轻轻按过。',
  '照片里没有猫，只有一只空纸箱和很好的阳光。',
];

export const WEATHERS = ['晴', '微风', '阴', '小雨', '薄雾', '雪后'];

// 收集品 rarity 只影响抽取权重和展示样式，不参与存档结构变化。
export const SOUVENIRS = [
  {
    id: 'pretty_feather',
    name: '漂亮羽毛',
    rarity: 'common',
    description: '不知道是哪只鸟掉的。',
  },
  {
    id: 'half_ticket',
    name: '半张车票',
    rarity: 'common',
    description: '只剩下一半，看不出终点。',
  },
  {
    id: 'small_shell',
    name: '小贝壳',
    rarity: 'uncommon',
    description: '贴近耳朵时，好像能听见很远的风。',
  },
  {
    id: 'round_stone',
    name: '圆石子',
    rarity: 'common',
    description: '被水磨得很光滑。',
  },
  {
    id: 'old_button',
    name: '旧纽扣',
    rarity: 'uncommon',
    description: '也许来自某件很旧的外套。',
  },
  {
    id: 'unknown_keyring',
    name: '不知道哪来的钥匙圈',
    rarity: 'rare',
    description: '猫看起来很得意，但你完全不知道它从哪弄来的。',
  },
];
