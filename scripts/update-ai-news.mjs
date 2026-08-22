import { writeFile } from 'node:fs/promises';

const OUTPUT_FILE = new URL('../ai-news.json', import.meta.url);
const MAX_NEWS = 8;

function shanghaiYesterday() {
  const now = new Date();
  const shanghaiNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
  shanghaiNow.setDate(shanghaiNow.getDate() - 1);
  return `${shanghaiNow.getFullYear()}-${String(shanghaiNow.getMonth() + 1).padStart(2, '0')}-${String(shanghaiNow.getDate()).padStart(2, '0')}`;
}

async function fetchText(url, timeoutMs = 20000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'TT-Workbench-AI-News/1.0' }
    });
    if (!response.ok) throw new Error(`${response.status} ${url}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function cleanMarkdown(raw) {
  const content = raw.split('Markdown Content:').slice(1).join('Markdown Content:') || raw;
  return content
    .split('\n')
    .filter(line => (line.match(/\|/g) || []).length < 3)
    .filter(line => !/^\s*(Title|URL Source|Published Time):/i.test(line))
    .join(' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*]>?\s+/gm, '')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[_*`>#]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitText(text, maxLength = 1150) {
  const chunks = [];
  let rest = text;
  while (rest.length) {
    let end = Math.min(maxLength, rest.length);
    if (end < rest.length) {
      const boundary = Math.max(rest.lastIndexOf('. ', end), rest.lastIndexOf('。', end));
      if (boundary > maxLength * 0.55) end = boundary + 1;
    }
    chunks.push(rest.slice(0, end));
    rest = rest.slice(end).trim();
  }
  return chunks;
}

async function translate(text) {
  if (!text || /[\u4e00-\u9fff]/.test(text.slice(0, 120))) return text;
  const translated = [];
  for (const chunk of splitText(text)) {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=${encodeURIComponent(chunk)}`;
    const payload = JSON.parse(await fetchText(url, 15000));
    translated.push((payload[0] || []).map(part => part[0] || '').join(''));
  }
  return translated.join('').replace(/\s+/g, ' ').trim();
}

function shorten(text, maxLength) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;
  const slice = clean.slice(0, maxLength);
  const boundary = Math.max(slice.lastIndexOf('。'), slice.lastIndexOf('！'), slice.lastIndexOf('？'));
  return `${slice.slice(0, boundary > maxLength * 0.55 ? boundary + 1 : maxLength)}…`;
}

function categoryFor(text) {
  if (/学生|作业|考试|教育|学习|课堂|school|student|homework|exam|education/i.test(text)) return 'education';
  if (/工作|就业|失业|岗位|职业|劳动力|job|worker|employment|workplace/i.test(text)) return 'jobs';
  if (/写作|文档|文本|书籍|版权|出版|知识|内容|writing|book|document|copyright|content|AI-blind|AI;DR|meat proxy/i.test(text)) return 'content';
  if (/漏洞|网络安全|恶意软件|cyber|vulnerability|CVE|malware/i.test(text)) return 'cyber';
  if (/安全|风险|攻击|欺骗|监管|隐私|security|safety|risk/i.test(text)) return 'safety';
  if (/智能体|AI agent|agents|编程助手|coding agent|workflow/i.test(text)) return 'agent';
  if (/研究|论文|模型|训练|推理|benchmark|research|model|reasoning/i.test(text)) return 'research';
  if (/公司|融资|企业|产品|发布|收购|开源|business|launch|company|open source/i.test(text)) return 'business';
  return 'general';
}

function buildExplanations(category, title, overview) {
  const fact = shorten(overview, 180);
  const beginnerLead = {
    education: '这类新闻讨论的是“AI 帮你完成任务”和“AI 帮你真正学会”之间的差别。作业分数提高，可能只是学生更容易得到答案；只有离开 AI 后仍能独立完成考试、解释思路和迁移知识，才说明学习能力真的提高了。还需要区分相关性与因果关系，并检查不同年龄、学科和使用方式是否得到相同结果。',
    jobs: '这里担心的并不只是某个岗位会被机器完全替代，更常见的变化是：一个岗位中的部分任务先被自动化，企业随之减少初级职位、提高产出要求，或者重新组合人的职责。调查反映的是人们对这种变化的预期与焦虑，不能直接等同于已经发生的实际失业数量。',
    content: '这类新闻关注 AI 生成内容进入写作、文档、出版和知识传播后的后果。AI 可以快速扩写和整理材料，但如果作者没有核查、删减和重新组织，阅读成本就会被转嫁给接收者；涉及书籍和训练数据时，还会牵涉版权、公共知识保存以及谁控制数字副本的问题。',
    cyber: '可以把这类测试理解为让不同 AI 模型参加同一场“找软件漏洞”的实战考试。模型不仅要指出哪里可能有问题，还要给出可复现的证据并控制误报。一次运行找不到全部漏洞并不罕见，所以重复测试、人工复核和成本对比，比单看某次最高成绩更有意义。',
    safety: '可以把这件事理解成：AI 的能力提高后，不只会带来更好用的功能，也可能放大错误、攻击或滥用的后果。判断风险不能只看模型“答对了多少题”，还要看它在真实环境中会不会越权、误导用户，以及出问题时人能否及时叫停。',
    agent: '这里的“AI 智能体”不是只负责聊天的机器人，而是会自己拆解任务、调用工具、修改文件并连续执行多步操作的软件助手。它能节省重复劳动，但也意味着一次错误可能被自动执行很多步，因此权限范围、人工确认和执行记录都很关键。',
    research: '这类研究关注的不是 AI 会不会背答案，而是它在没有标准答案时能否提出假设、设计实验、判断证据并修正方向。模型在基准测试上得分高，并不等于它已经具备人类研究者的判断力、创造力和长期规划能力。',
    business: '这条新闻表面上是公司或产品动态，背后反映的是 AI 正从实验室技术变成真正进入工作流程的服务。是否能落地，不只取决于模型聪明程度，还取决于成本、数据权限、可靠性、合规和用户是否愿意改变原有习惯。',
    general: '理解这条新闻时，可以把 AI 看成一种仍在快速迭代的通用工具：它的能力、使用方式和限制会同时变化。新闻中的新功能或新结论需要结合适用范围、测试条件和真实使用场景来看，不能只依据一个醒目的标题下结论。'
  }[category];
  const whyTail = {
    education: '它会影响学校如何布置作业、评价学生以及制定 AI 使用规则。如果 AI 只提高提交结果却削弱独立思考，教育目标就需要从“交出正确答案”转向展示过程、口头解释和无辅助测验，同时也要研究怎样使用 AI 才能真正促进理解。',
    jobs: '它会影响个人选择技能、企业安排招聘以及政府设计培训和保障政策。真正需要继续观察的是哪些具体任务被自动化、生产率收益如何分配、初级岗位是否减少，以及员工能否获得转岗机会，而不是只讨论“AI 会不会抢工作”的二元问题。',
    content: '它关系到工作沟通的可信度、知识是否仍能被公共访问，以及内容生产的责任由谁承担。如果 AI 让生成材料变得近乎零成本，但核查成本仍由读者承担，组织就需要明确作者署名、事实检查、引用来源和人工审核规则。',
    cyber: '它直接关系到企业能否更早发现漏洞，也关系到攻击者是否会获得同样的自动化能力。模型价格、重复运行的一致性、误报率和开放模型能力都会影响安全团队的工具选择，也会改变漏洞发现与修补之间的速度竞争。',
    safety: '它会影响模型上线前需要做哪些安全评估、企业应给 AI 多大权限，以及普通用户能否识别并纠正 AI 的错误。若相关问题不能被可靠控制，能力更强的模型反而可能带来更高的现实成本。',
    agent: '这决定了未来大量电脑工作能否从“人一步步操作”转向“人提出目标、AI 负责执行”。对个人意味着工作方式变化；对企业则意味着需要重新设计审批、审计、数据隔离和责任边界。',
    research: '这关系到 AI 进步速度的判断。如果模型只能高效完成可评分的窄任务，却难以进行开放式研究，那么“AI 很快能自动改进自己”的时间表可能需要重新评估，也会影响算力投入和技术路线。',
    business: '它能帮助判断 AI 市场究竟是在制造短期热度，还是已经形成可持续产品。后续应关注真实用户留存、部署成本、数据安全和竞争对手反应，而不只是发布当天的宣传。',
    general: '它提供了观察 AI 能力边界和应用方向的新证据。真正值得关注的是后续能否被独立验证、能否在更多场景复现，以及它会不会改变人们使用软件和处理信息的方式。'
  }[category];
  return {
    beginner: `${beginnerLead} 具体到《${title}》，原文的核心事实是：${fact}`,
    why: `原文给出的关键事实是：${fact} 这条新闻的重要性不只在于出现了一项新动态，更在于它暴露了当前 AI 能做什么、还做不好什么。${whyTail} 结合原文来看，最值得继续观察的是相关结论能否在真实环境中复现，以及行业是否会据此调整产品和规则。`
  };
}

function keywordsFor(category) {
  const map = {
    education: [{ term: '学习成果', explain: '学生离开辅助工具后仍能理解、解释并独立运用知识的能力。' }, { term: '对照组', explain: '没有使用某项工具、用于比较效果差异的一组参与者。' }],
    jobs: [{ term: '任务自动化', explain: 'AI 先接手一个岗位中的部分任务，而不一定一次替代整个职业。' }, { term: '劳动力转型', explain: '岗位要求、招聘结构和员工技能因新技术应用而发生变化。' }],
    content: [{ term: 'AI 生成内容', explain: '由模型生成或大幅改写的文字、图像及其他材料。' }, { term: '人工审核', explain: '由作者核对事实、删除冗余并对最终内容承担责任。' }],
    cyber: [{ term: '漏洞召回率', explain: '已知或可发现漏洞中，被模型成功找到的比例。' }, { term: '误报', explain: '模型把正常代码错误判断为漏洞，会增加人工核查成本。' }],
    safety: [{ term: 'AI 安全评估', explain: '在模型上线前测试它是否会产生危险行为、泄露信息或被恶意利用。' }, { term: '权限边界', explain: '规定 AI 可以访问哪些数据、调用哪些工具，以及哪些操作必须由人确认。' }],
    agent: [{ term: 'AI 智能体', explain: '能够规划步骤、调用工具并持续执行任务的 AI 系统。' }, { term: '人工确认', explain: '在发送、删除、付款等关键操作前，必须由真人明确批准。' }],
    research: [{ term: '开放式研究', explain: '没有唯一标准答案，需要提出假设、判断证据并不断调整方向的研究。' }, { term: '基准测试', explain: '用统一题目衡量模型能力，但成绩不一定代表真实场景表现。' }],
    business: [{ term: 'AI 落地', explain: '把模型接入真实业务流程，并在成本、稳定性和合规方面可持续运行。' }, { term: '数据治理', explain: '管理数据如何被访问、使用、保存和审计的一整套规则。' }],
    general: [{ term: '大语言模型', explain: '通过大量文本训练、能够理解和生成自然语言的 AI 模型。' }, { term: '能力边界', explain: 'AI 在哪些条件下可靠、在哪些任务上仍容易出错。' }]
  };
  return map[category];
}

async function articleToNews(candidate, date, index) {
  const readerUrl = `https://r.jina.ai/http://${candidate.url.replace(/^https?:\/\//, '')}`;
  const markdown = await fetchText(readerUrl);
  const original = cleanMarkdown(markdown).slice(0, 4200);
  if (original.length < 450) throw new Error(`Article too short: ${candidate.url}`);
  const [title, translatedBody] = await Promise.all([
    translate(candidate.title),
    translate(original.slice(0, 2300))
  ]);
  const summary = shorten(translatedBody, 720);
  const overview = shorten(summary, 300);
  const category = categoryFor(`${candidate.title} ${title}`);
  const explanations = buildExplanations(category, title, overview);
  let sourceName = '新闻原文';
  try { sourceName = new URL(candidate.url).hostname.replace(/^www\./, ''); } catch {}
  return {
    id: `daily-${date}-${index + 1}`,
    title,
    originalTitle: candidate.title,
    time: date,
    overview,
    summary,
    beginner: explanations.beginner,
    why: explanations.why,
    keywords: keywordsFor(category),
    source: candidate.url,
    sourceName
  };
}

async function main() {
  const date = shanghaiYesterday();
  const start = Math.floor(new Date(`${date}T00:00:00+08:00`).getTime() / 1000);
  const filters = `created_at_i>=${start},created_at_i<${start + 86400}`;
  const endpoint = `https://hn.algolia.com/api/v1/search_by_date?query=AI&tags=story&hitsPerPage=100&numericFilters=${encodeURIComponent(filters)}`;
  const payload = JSON.parse(await fetchText(endpoint));
  const aiPattern = /\b(AI|LLM|OpenAI|Anthropic|Gemini|Claude|ChatGPT|machine learning|artificial intelligence|neural|language model|AI agent)\b/i;
  const seen = new Set();
  const candidates = (payload.hits || [])
    .filter(item => item.title && item.url && aiPattern.test(`${item.title} ${item.url}`))
    .filter(item => !/^(Show|Ask) HN:/i.test(item.title))
    .filter(item => {
      const key = item.title.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => ((b.points || 0) + (b.num_comments || 0) * 2) - ((a.points || 0) + (a.num_comments || 0) * 2));

  const items = [];
  for (const candidate of candidates.slice(0, 18)) {
    if (items.length >= MAX_NEWS) break;
    try {
      items.push(await articleToNews(candidate, date, items.length));
    } catch (error) {
      console.warn(`Skipped ${candidate.url}: ${error.message}`);
    }
  }
  if (items.length < 4) throw new Error(`Only generated ${items.length} usable news items`);
  const result = { date, generatedAt: new Date().toISOString(), source: 'Hacker News + original articles', items };
  await writeFile(OUTPUT_FILE, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(`Generated ${items.length} AI news items for ${date}`);
}

await main();
