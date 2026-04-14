/**
 * TokenGuard Core: Semantic Code Dehydrator
 * 将代码压缩到极致，同时保留 AI 可读性
 */

export interface DehydratorResult {
  markdown: string;
  originalLength: number;
  compressedLength: number;
  savedPercent: number;
  variableMap: Map<string, string>;
}

export interface FunctionSignature {
  name: string;
  params: string[];
  returnType: string;
  body: string;
  fullSignature: string;
}

/**
 * 保护 Python 缩进的行压缩
 * 保留行首缩进，去除行尾空白，过滤空行
 */
function preservePythonIndentation(code: string): string {
  const lines = code.split('\n');
  const processed = lines
    .map((line: string) => line.trimEnd())
    .filter((line: string) => line.length > 0);
  return processed.join('\n');
}

/**
 * 核心脱水算法 - semanticSkim
 * @param code 原始代码
 * @param options 可选配置
 */
export async function semanticSkim(
  code: string,
  options: {
    shortFunctionThreshold?: number;
    preserveComments?: boolean;
  } = {}
): Promise<DehydratorResult> {
  const { shortFunctionThreshold = 5 } = options;
  const originalLength = code.length;
  const variableMap = new Map<string, string>();

  let processed = code;

  // 阶段 1: 注释移除
  processed = removeComments(processed);

  // 阶段 2: Log 语句移除
  processed = removeLogs(processed);

  // 阶段 3: 提取函数签名（改进版）
  const functionSignatures = extractSignatures(processed);
  processed = replaceWithSignatures(processed, functionSignatures, shortFunctionThreshold);

  // 阶段 4: 变量缩短（智能映射）
  processed = shortenVariables(processed, variableMap);

  // 阶段 5: 逻辑锚点保留（关键）
  processed = preserveLogicAnchors(processed);

  // 阶段 6: Try-Catch Boilerplate 精简
  processed = condenseTryCatch(processed);

  // 阶段 7: Python 缩进保护
  processed = preservePythonIndentation(processed);

  // 计算压缩结果
  const compressedLength = processed.length;
  const savedPercent = Math.round((1 - compressedLength / originalLength) * 100);

  // 生成 Markdown（带 XML 标签）
  const markdown = generateMarkdown(
    processed,
    savedPercent,
    variableMap,
    functionSignatures
  );

  return {
    markdown,
    originalLength,
    compressedLength,
    savedPercent: Math.max(0, savedPercent),
    variableMap,
  };
}

/**
 * 移除所有注释
 */
function removeComments(code: string): string {
  // 单行注释
  let result = code.replace(/\/\/.*$/gm, "");
  // 多行注释
  result = result.replace(/\/\*[\s\S]*?\*\//g, "");
  return result;
}

/**
 * 移除 Log 语句
 */
function removeLogs(code: string): string {
  return code
    .replace(/\bconsole\.(log|debug|info|warn|error)\s*\([^)]*\)\s*;?/gi, "")
    .replace(/\bconsole\.log\s*\((['"`]).*\1\)\s*;?/gi, "")
    .replace(/logger\.(log|debug|info|warn|error)\s*\([^)]*\)\s*;?/gi, "")
    .replace(/print\s*\([^)]*\)\s*;?/gi, "")
    .replace(/\bconsole\b\.?\w*\s*\(/gi, "");
}

/**
 * 提取所有函数签名（改进：支持 export/async/private/public/static/constructor）
 */
function extractSignatures(code: string): FunctionSignature[] {
  const signatures: FunctionSignature[] = [];

  // 改进的正则：匹配各种函数定义
  const patterns = [
    // 箭头函数
    /(?:export\s+)?(?:async\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>\s*(?:{[\s\S]*?}|(?:[^;]*?))/g,
    // 常规函数声明（export/async/private/public/static/constructor）
    /(?:export\s+)?(?:async\s+)?(?:private\s+|public\s+|protected\s+)?(?:static\s+)?(?:function|constructor)\s+(\w+)\s*\(([^)]*)\)\s*{([\s\S]*?)}/g,
    // 简写方法（class 内）
    /(?:private\s+|public\s+|protected\s+)?(?:static\s+)?(\w+)\s*\(([^)]*)\)\s*{([\s\S]*?)}/g,
  ];

  for (const pattern of patterns) {
    let match;
    // 重置正则索引
    pattern.lastIndex = 0;
    while ((match = pattern.exec(code)) !== null) {
      const name = match[1];
      const params = match[2]
        .split(',')
        .map((p: string) => p.trim())
        .filter((p: string) => p.length > 0);
      // 箭头函数不处理 body
      const isArrowFunction = match[0].includes('=>');
      const body = isArrowFunction ? '' : match[3];
      const fullSignature = match[0].split('{')[0].trim();

      // 避免重复
      if (!signatures.some(s => s.name === name && s.params.join(',') === params.join(','))) {
        signatures.push({
          name,
          params,
          returnType: '',
          body,
          fullSignature,
        });
      }
    }
  }

  return signatures;
}

/**
 * 从函数提取参数（备用）
 */
function extractParams(funcStr: string): string[] {
  const paramMatch = funcStr.match(/\(([^)]*)\)/);
  if (!paramMatch) return [];
  return paramMatch[1]
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * 用签名替换函数体（优化隐藏文案）
 */
function replaceWithSignatures(
  code: string,
  signatures: FunctionSignature[],
  threshold: number
): string {
  let result = code;

  for (const sig of signatures) {
    if (!sig.body || sig.body.trim().length === 0) continue;

    const bodyLines = sig.body.split("\n").filter((l: string) => l.trim());
    if (bodyLines.length < threshold) {
      continue;
    }

    // 优化隐藏文案
    const comment = `// [Logic: ${sig.name}(${sig.params.join(", ")}) - ${bodyLines.length} lines hidden]`;
    result = result.replace(sig.body, comment);
  }

  return result;
}

/**
 * 变量名缩短并生成映射表（仅记录实际缩短的变量）
 */
function shortenVariables(code: string, variableMap: Map<string, string>): string {
  const commonPatterns = [
    { pattern: /\brequestData\b/g, short: "rd" },
    { pattern: /\bresponseData\b/g, short: "rsp" },
    { pattern: /\buserData\b/g, short: "ud" },
    { pattern: /\bconfig\b/g, short: "cfg" },
    { pattern: /\bcallback\b/g, short: "cb" },
    { pattern: /\bresult\b/g, short: "res" },
    { pattern: /\berror\b/g, short: "err" },
    { pattern: /\btemp\b/g, short: "tmp" },
    { pattern: /\bdata\b/g, short: "d" },
    { pattern: /\bitem\b/g, short: "i" },
    { pattern: /\bindex\b/g, short: "idx" },
    { pattern: /\bvalue\b/g, short: "v" },
    { pattern: /\boptions\b/g, short: "opts" },
    { pattern: /\bparameters?\b/g, short: "params" },
  ];

  let result = code;
  for (const { pattern, short } of commonPatterns) {
    const original = pattern.source.match(/\b\w+\b/)?.[0];
    if (!original) continue;

    // 检查是否真的存在该变量
    if (!pattern.test(result)) continue;

    // 检查长度是否确实缩短
    if (original.length <= short.length) continue;

    // 只记录实际发生的替换
    if (!variableMap.has(original)) {
      variableMap.set(original, short);
    }
    result = result.replace(pattern, short);
  }

  return result;
}

/**
 * 精简 Try-Catch
 */
function condenseTryCatch(code: string): string {
  return code.replace(
    /try\s*\{[\s\S]*?\}\s*catch\s*\([^)]*\)\s*\{[\s\S]*?throw[^}]*;?\}?/gi,
    "// [Error handling hidden]"
  );
}

/**
 * 逻辑锚点保留（核心新功能）
 * 保留：return、条件判断行、带 // ! 注释的行
 */
function preserveLogicAnchors(code: string): string {
  const lines = code.split('\n');
  const preservedLines: string[] = [];
  let inBlock = false;
  let blockDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 保留带 // ! 注释的行
    if (trimmed.includes('// !')) {
      preservedLines.push(line);
      continue;
    }

    // 检测代码块开始
    if (trimmed.endsWith('{') || trimmed.includes('{') && !trimmed.startsWith('//')) {
      inBlock = true;
      blockDepth++;
    }

    // 保留 return 语句
    if (trimmed.startsWith('return ') || trimmed === 'return') {
      preservedLines.push(line);
      continue;
    }

    // 保留条件判断（if/else/switch/catch 行本身，不保留内容）
    if (/^(if|else\s+if|else|switch|catch)\s*\(/.test(trimmed) ||
        trimmed.match(/^(?:private|public|protected)\s+(?:static\s+)?(?:async\s+)?\w+\s*\([^)]*\)\s*{/) ||
        trimmed.match(/^(?:async\s+)?(?:function|constructor)\s+\w+/)) {
      preservedLines.push(line);
      continue;
    }

    // 代码块结束
    if (trimmed.startsWith('}')) {
      blockDepth--;
      if (blockDepth <= 0) {
        inBlock = false;
        blockDepth = 0;
      }
    }

    // 在代码块内但非锚点，跳过（删除内容）
    // 不在代码块内（如函数签名行），保留
    if (!inBlock) {
      preservedLines.push(line);
    }
  }

  return preservedLines.join('\n');
}

/**
 * 生成最终 Markdown（带 XML 标签）
 */
function generateMarkdown(
  content: string,
  savedPercent: number,
  variableMap: Map<string, string>,
  signatures: FunctionSignature[]
): string {
  const parts: string[] = [];

  // XML 标签包裹
  parts.push('<code_to_refactor>\n');
  parts.push(`⚡ **Compressed by TokenGuard** (Saved ${savedPercent}%)\n`);
  parts.push("---\n");
  parts.push("```\n" + content.trim() + "\n```\n");

  // 变量映射表（仅显示真正缩短的）
  if (variableMap.size > 0) {
    parts.push("\n**Variable Mapping:**\n");
    parts.push("```\n");
    for (const [original, short] of variableMap) {
      parts.push(`  ${original} → ${short}\n`);
    }
    parts.push("```\n");
  }

  // 函数签名表
  if (signatures.length > 0) {
    parts.push("\n**Function Signatures:**\n");
    parts.push("```\n");
    for (const sig of signatures) {
      parts.push(`  ${sig.name}(${sig.params.join(", ")})\n`);
    }
    parts.push("```\n");
  }

  parts.push('</code_to_refactor>\n');

  return parts.join("");
}

export default semanticSkim;
