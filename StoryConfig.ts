/**
 * 剧情文本配置表 —— 女官婚恋流程 6 类剧本（求娶/赐婚/婚后四剧情）
 * 变量占位符：{selfName}=女官名 {name}=朝臣名 {title}=官职 {trait}=外貌气质 {title}=帝宠
 * 文本由 StorySystem 填充变量后交 UI 展示；本文件纯文案，不含逻辑。
 */
import { MaritalEventType, StoryTemplate, StoryType } from '../types/types';

/** 婚后事件类型 → 剧情类型映射（事件消费层用） */
export const MARITAL_EVENT_TO_STORY: Record<MaritalEventType, StoryType> = {
  [MaritalEventType.AFFECTIONATE]: StoryType.MARITAL_AFFECTIONATE,
  [MaritalEventType.QUARREL]: StoryType.MARITAL_QUARREL,
  [MaritalEventType.SOLITUDE]: StoryType.MARITAL_SOLITUDE,
  [MaritalEventType.BIRTHDAY]: StoryType.MARITAL_BIRTHDAY,
};

export const STORY_TEMPLATES: StoryTemplate[] = [
  // ——————————————— 求娶剧情 ———————————————
  {
    id: StoryType.PROPOSAL,
    title: '相许·求娶',
    steps: [
      { speaker: 'narrator', text: '宫宴将散，烛火摇曳。{name}借着敬酒之名，行至你身侧。' },
      { speaker: 'npc', text: '{selfName}，我观你才情品貌，远超寻常女官。这几番相处，我心中早已……', emotion: '含情' },
      { speaker: 'self', text: '大人慎言，此处人多口杂。', emotion: '低眉' },
      { speaker: 'npc', text: '我意已决。待时机成熟，必当面向圣上请旨，聘你为妻。', emotion: '郑重' },
      { speaker: 'narrator', text: '你心头一震。这是相许之约，也是一道难以抉择的牵绊。' },
    ],
    choices: [
      { id: 'accept', label: '含羞应允', outcome: 'accept' },
      { id: 'reject', label: '婉言谢绝', outcome: 'reject' },
    ],
  },
  // ——————————————— 赐婚剧情 ———————————————
  {
    id: StoryType.IMPERIAL_DECREE,
    title: '奉旨·赐婚',
    steps: [
      { speaker: 'narrator', text: '翌日早朝，圣旨宣于殿前，满朝文武皆惊。' },
      { speaker: 'narrator', text: '「女官{selfName}，淑慎端良，才德兼备，今赐婚与{title}{name}，即日完婚。」' },
      { speaker: 'npc', text: '我从前只道你是同僚，不想竟是天赐的缘分。', emotion: '欣喜' },
      { speaker: 'self', text: '大人……此后，便劳烦了。', emotion: '含羞' },
      { speaker: 'narrator', text: '红绸十里，钟鼓齐鸣。你的名字，从此与这位{title}紧紧相连。' },
    ],
  },
  // ——————————————— 婚后·恩爱 ———————————————
  {
    id: StoryType.MARITAL_AFFECTIONATE,
    title: '婚后·琴瑟和鸣',
    steps: [
      { speaker: 'narrator', text: '月下庭中，{name}为你拂去肩上落花。' },
      { speaker: 'npc', text: '自娶你为妻，我这一生，再无他求。', emotion: '温柔' },
      { speaker: 'self', text: '大人……何其有幸。', emotion: '含羞' },
      { speaker: 'narrator', text: '这一刻，权势官位皆成浮云，唯有眼前人真实可握。' },
    ],
  },
  // ——————————————— 婚后·争执 ———————————————
  {
    id: StoryType.MARITAL_QUARREL,
    title: '婚后·闺阁争执',
    steps: [
      { speaker: 'narrator', text: '为着朝堂上的一桩政见，你与{name}争执不下。' },
      { speaker: 'npc', text: '你为何总是这般执拗？', emotion: '愠怒' },
      { speaker: 'self', text: '我若不争，如何对得起这身官服？', emotion: '执拗' },
      { speaker: 'narrator', text: '一室沉默。夫妻之间，最难得的从不是同心，而是容得下不同。' },
    ],
  },
  // ——————————————— 婚后·独处 ———————————————
  {
    id: StoryType.MARITAL_SOLITUDE,
    title: '婚后·独处幽思',
    steps: [
      { speaker: 'narrator', text: '夫君赴衙当值，独守庭院的夜里，你翻看旧日卷宗。' },
      { speaker: 'self', text: '虽是相许之人，却也各有各的战场。', emotion: '幽思' },
      { speaker: 'narrator', text: '你提笔写下二字——相望。窗外月色，恰如初见那夜。' },
    ],
  },
  // ——————————————— 婚后·生辰 ———————————————
  {
    id: StoryType.MARITAL_BIRTHDAY,
    title: '婚后·夫君生辰',
    steps: [
      { speaker: 'narrator', text: '{name}生辰，你备下一方亲手临摹的字画相赠。' },
      { speaker: 'npc', text: '你竟还记得……', emotion: '动容' },
      { speaker: 'self', text: '夫君生辰，怎会忘记。', emotion: '温柔' },
      { speaker: 'narrator', text: '他握着礼物的手微微发颤。这一刻，你看见了朝堂之外，那个真实的他。' },
    ],
  },
];

const TEMPLATE_MAP: Record<string, StoryTemplate> = {};
STORY_TEMPLATES.forEach((t) => { TEMPLATE_MAP[t.id] = t; });

export function getStoryTemplate(type: StoryType): StoryTemplate | undefined {
  return TEMPLATE_MAP[type];
}
