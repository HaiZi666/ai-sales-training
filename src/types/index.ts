// 家长心理类型（与成绩画像独立，控制沟通风格与反应）
export type ParentType =
  | 'anxiety'
  | 'rational'
  | 'price_sensitive'
  | 'controlling'
  | 'busy'
  | 'cautious';

// 客户类型
export type CustomerType = 'type_a' | 'type_b' | 'type_c';

// 客户成绩分段
export type CustomerScore = '优秀' | '中游' | '较差';

// 对话节点
export type DialogNode = 
  | '开场'
  | '挖需求'
  | '提信心'
  | '举例'
  | '给方案'
  | '邀约确认';

// 演练状态
export type SessionStatus = 'active' | 'finished';

// 消息角色
export type MessageRole = 'ai' | 'sales';

// 评分维度
export interface DimensionScore {
  name: string;
  score: number;
  max: number;
  detail: string;
}

// 节点评分
export interface NodeScore {
  node: DialogNode;
  score: number;
  maxScore: number;
  feedback: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
}

// 演练报告
export interface PracticeReport {
  sessionId: string;
  totalScore: number;
  grade: string;
  dimensions: DimensionScore[];
  highlight: string;
  weakness: string;
  improvements: string[];
}

// 对话消息
export interface Message {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  audioUrl?: string;
  node: DialogNode;
  createdAt: string;
}

// 演练会话
export interface Session {
  id: string;
  salespersonId: string;
  customerType: CustomerType;
  customerScore: CustomerScore;
  customerSubject: string;
  status: SessionStatus;
  currentNode: DialogNode;
  messages: Message[];
  scores: NodeScore[];
  startedAt: string;
  finishedAt?: string;
  // 新增字段
  customerChannel?: 'direct_push' | 'whitelist';
  examNode?: '开学考' | '月考' | '期中考' | '期末考' | '寒暑假';
  grade?: '初一' | '初二' | '初三' | '高一' | '高二' | '高三';
  /** 家长心理/沟通风格（与 customerType 成绩画像叠加） */
  parentType?: ParentType;
  /** 新建演练时选择的默认交互模式 */
  voiceMode?: boolean;
}

// 评分配置
export const SCORING_CONFIG: Record<DialogNode, { maxScore: number; criteria: string[] }> = {
  开场: {
    maxScore: 15,
    criteria: [
      '自我介绍是否清晰（机构名 + 老师身份）',
      '是否提及当下需求（如：期中考试后/免费体验）',
      '话术是否简洁明了',
    ],
  },
  挖需求: {
    maxScore: 25,
    criteria: [
      '是否询问学生最近一次考试的成绩',
      '是否询问分数/班级/年级排名',
      '是否了解弱科及弱项',
      '是否按成绩分段分层应对',
      '是否帮学生预设目标并提醒差距',
    ],
  },
  提信心: {
    maxScore: 15,
    criteria: [
      '是否有分析学生不爱学习/进步慢的原因',
      '是否针对不同成绩分层提信心',
      '是否有举案例佐证',
    ],
  },
  举例: {
    maxScore: 20,
    criteria: [
      '是否举了真实案例（相似情况）',
      '案例是否有变化过程描述',
      '案例是否按成绩分层匹配',
      '是否举了克服困难到店的案例',
    ],
  },
  给方案: {
    maxScore: 15,
    criteria: [
      '是否给出可行性方案',
      '方案是否结合产品功能',
      '是否再次邀约到店',
    ],
  },
  邀约确认: {
    maxScore: 10,
    criteria: [
      '是否和家长协商好具体到店时间',
      '是否发送服务中心位置/门头照片',
      '是否发送预约到店消息（含时间、地点、联系人）',
    ],
  },
};

// 客户类型配置
export const CUSTOMER_TYPE_CONFIG: Record<CustomerType, {
  name: string;
  description: string;
  typicalQuestions: string[];
  promptAddition: string;
}> = {
  type_a: {
    name: '成绩优秀型',
    description: '目标高、挑剔、喜欢比较',
    typicalQuestions: [
      '你们师资比别家强在哪？',
      '老师是什么背景？',
      '能保证提分吗？',
    ],
    promptAddition: '你是成绩优秀学生的家长，孩子目标是重点高中/985院校。你会反复比较机构优劣，态度挑剔但有耐心。需要销售展示专业性和师资实力。',
  },
  type_b: {
    name: '成绩中游型',
    description: '犹豫不决、需要案例说服',
    typicalQuestions: [
      '有没有和我家孩子情况类似的例子？',
      '效果怎么样？',
      '真的能提分吗？',
    ],
    promptAddition: '你是成绩中等学生的家长，孩子有提升空间但缺乏动力。你关心效果和案例，容易犹豫不决。需要销售用真实案例打动你。',
  },
  type_c: {
    name: '成绩较差型',
    description: '焦虑、担心花钱无效',
    typicalQuestions: [
      '孩子基础很差，还能补吗？',
      '多久能看到效果？',
      '要是没效果钱不是白花了？',
    ],
    promptAddition: '你是成绩较差学生的家长，孩子基础薄弱或对学习没兴趣。你焦虑且担心花了钱没效果，关心价格和风险。需要销售打消顾虑并给出信心。',
  },
};

// 节点流程顺序
export const NODE_ORDER: DialogNode[] = ['开场', '挖需求', '提信心', '举例', '给方案', '邀约确认'];
