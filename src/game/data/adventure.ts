/** Authored discoveries use existing Three.js rune props and need no downloaded assets. */
export const MEMORIES = [
  { id: 'grass-memory', level: 0, x: 1240, y: 930, title: '第一束光', text: '守灯人曾把灯放在路边。迷路的人看见光，就知道有人还在等。', reward: '解锁琥珀灯焰', color: '#f3bd62' },
  { id: 'forest-memory', level: 1, x: 830, y: 650, title: '树灵的石语', text: '石碑上的根须托起月亮，月光落入潮水。枝 → 月 → 潮，这就是森林的回声。', reward: '解锁青碧灯焰', color: '#8be0c9' },
  { id: 'sunken-memory', level: 2, x: 1770, y: 990, title: '未送出的信', text: '水位漫过回廊以前，守门人把最后一艘浮台留给了归来的旅人。', reward: '解锁潮蓝灯焰', color: '#7ce4ea' },
  { id: 'mine-memory', level: 3, x: 520, y: 420, title: '矿工的约定', text: '最后离开的矿工留下了支撑杆：听见轰鸣就往亮处跑，休息灯旁的岩层最稳。', reward: '解锁余烬灯焰', color: '#f0a36e' },
  { id: 'core-memory', level: 4, x: 1820, y: 940, title: '守塔者', text: '它曾守护所有人的归路。五枚灯芯不是武器，而是让它想起使命的光。', reward: '解锁月白灯焰', color: '#e1eee2' },
] as const;

export const BEACONS: Record<string, string[]> = {
  'mist-grassland': ['grass-beacon-north', 'grass-beacon-south'],
  'lighthouse-core': ['core-beacon-north', 'core-beacon-south'],
};

export const FRAGMENT_STORIES = [
  '碎片中留着草原风声：原来遗迹也曾是一条回家的路。',
  '碎片中的树影开始发亮：森林记住了你的脚步。',
  '碎片映出一片退去的潮水：有人曾在这里等待。',
  '碎片里传来微弱敲击：矿道尽头，仍有一盏灯。',
  '碎片映出完整的灯塔：你已经走到了故事的最后。',
];
