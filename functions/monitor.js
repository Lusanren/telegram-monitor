// Telegram 公开频道消息监控服务
// 部署在 Cloudflare Pages + Functions + KV 上
// 使用环境变量存储敏感信息，安全可靠

/**
 * 主函数 - 处理 HTTP 请求
 * @param {Request} request - HTTP 请求对象
 * @param {Object} env - 环境变量对象
 * @param {Object} ctx - 上下文对象
 * @returns {Response} - HTTP 响应对象
 */
export async function onRequest(context) {
  const { request, env } = context;
  
  // 记录请求开始
  console.log("=== Telegram 公开频道消息监控服务启动 ===");
  console.log(`请求时间: ${new Date().toISOString()}`);
  
  try {
    // 1. 验证必要的环境变量
    const config = validateConfig(env);
    if (!config) {
      return createErrorResponse(500, "缺少必要的环境变量，请在 Cloudflare Pages 中配置");
    }
    
    console.log(`监控频道数量: ${config.SOURCE_CHANNELS.length}`);
    console.log(`目标频道: ${config.TARGET_CHANNEL}`);
    console.log("使用网页抓取方式，无需 API ID 和登录");
    
    // 2. 初始化历史记录（首次运行时）
    await initializeHistory(env, config);
    
    // 3. 监控所有频道
    const results = await monitorAllChannels(env, config);
    
    // 4. 生成执行报告
    const report = generateReport(results);
    
    // 5. 返回成功响应
    return createSuccessResponse(report);
    
  } catch (error) {
    console.error(`监控服务执行失败: ${error}`);
    return createErrorResponse(500, `监控服务执行失败: ${error.message}`);
  }
}

/**
 * 验证和解析配置
 * @param {Object} env - 环境变量对象
 * @returns {Object|null} - 配置对象或 null
 */
function validateConfig(env) {
  // 检查必要的环境变量
  if (!env.BOT_TOKEN) {
    console.error("错误：缺少 BOT_TOKEN 环境变量");
    return null;
  }
  
  if (!env.TARGET_CHANNEL) {
    console.error("错误：缺少 TARGET_CHANNEL 环境变量");
    return null;
  }
  
  if (!env.SOURCE_CHANNELS) {
    console.error("错误：缺少 SOURCE_CHANNELS 环境变量");
    return null;
  }
  
  try {
    // 解析源频道配置
    const sourceChannels = JSON.parse(env.SOURCE_CHANNELS);
    if (!Array.isArray(sourceChannels) || sourceChannels.length === 0) {
      console.error("错误：SOURCE_CHANNELS 格式不正确，应为非空数组");
      return null;
    }
    
    return {
      BOT_TOKEN: env.BOT_TOKEN,
      TARGET_CHANNEL: env.TARGET_CHANNEL,
      SOURCE_CHANNELS: sourceChannels,
      CHECK_TIMEOUT: 5000,  // 网络请求超时（5秒）
      MESSAGE_HISTORY_SIZE: 50,  // 每个频道历史记录大小
      MESSAGE_SEND_DELAY: 1000  // 消息发送间隔（1秒）
    };
    
  } catch (error) {
    console.error(`解析 SOURCE_CHANNELS 失败: ${error}`);
    return null;
  }
}

/**
 * 初始化历史记录（参考 Python 版本）
 * @param {Object} env - 环境变量对象
 * @param {Object} config - 配置对象
 */
async function initializeHistory(env, config) {
  for (const channelInfo of config.SOURCE_CHANNELS) {
    const [channelUsername] = channelInfo;
    const historyKey = `history_${channelUsername}`;
    
    try {
      // 检查历史记录是否存在或为空
      const existingHistory = await env.MESSAGE_HISTORY.get(historyKey);
      let historyArray = [];
      
      if (existingHistory) {
        try {
          historyArray = JSON.parse(existingHistory);
          console.log(`发现现有历史记录，包含 ${historyArray.length} 条消息 ID`);
        } catch (parseError) {
          console.error(`解析历史记录失败: ${parseError}`);
          // 历史记录解析失败，视为不存在
          historyArray = [];
        }
      }
      
      // 如果历史记录不存在或为空，初始化历史记录
      if (!existingHistory || historyArray.length === 0) {
        console.log(`初始化频道 ${channelUsername} 的历史记录...`);
        
        // 获取频道消息（参考 Python 版本的 get_channel_messages）
        const messages = await getChannelMessages(channelUsername, config);
        console.log(`找到 ${messages.length} 条消息`);
        
        if (messages.length > 0) {
          // 提取消息 ID（参考 Python 版本的处理方式）
          const messageIds = messages.map(msg => msg.id);
          console.log(`提取到 ${messageIds.length} 个消息 ID`);
          
          // 限制历史记录大小（参考 Python 版本的 50 条限制）
          const recentIds = messageIds.slice(-config.MESSAGE_HISTORY_SIZE);
          console.log(`保存最近 ${recentIds.length} 条消息 ID`);
          
          // 保存历史记录（参考 Python 版本的 MESSAGE_HISTORY）
          await env.MESSAGE_HISTORY.put(historyKey, JSON.stringify(recentIds));
          console.log(`已初始化频道 ${channelUsername} 的历史记录`);
        } else {
          // 即使没有消息，也要创建空历史记录
          await env.MESSAGE_HISTORY.put(historyKey, JSON.stringify([]));
          console.log(`频道 ${channelUsername} 暂时没有消息，初始化空历史记录`);
        }
      } else {
        console.log(`频道 ${channelUsername} 的历史记录已存在且不为空，跳过初始化`);
      }
    } catch (error) {
      console.error(`初始化频道 ${channelUsername} 历史记录失败: ${error}`);
    }
  }
}

/**
 * 监控所有频道
 * @param {Object} env - 环境变量对象
 * @param {Object} config - 配置对象
 * @returns {Array} - 监控结果数组
 */
async function monitorAllChannels(env, config) {
  const results = [];
  
  for (const channelInfo of config.SOURCE_CHANNELS) {
    const [channelUsername, channelId] = channelInfo;
    console.log(`\n开始监控频道: ${channelUsername} (ID: ${channelId})`);
    
    try {
      // 1. 获取频道消息
      const messages = await getChannelMessages(channelUsername, config);
      console.log(`找到 ${messages.length} 条消息`);
      
      // 2. 过滤新消息
      const newMessages = await filterNewMessages(env, channelUsername, messages, config);
      console.log(`发现 ${newMessages.length} 条新消息`);
      
      // 3. 转发新消息
      const forwardedCount = await forwardMessages(newMessages, config);
      
      // 记录成功结果
      results.push({
        channel: channelUsername,
        channelId: channelId,
        success: true,
        totalMessages: messages.length,
        newMessages: newMessages.length,
        forwardedMessages: forwardedCount,
        error: null
      });
      
    } catch (error) {
      console.error(`监控频道 ${channelUsername} 时出错: ${error}`);
      
      // 记录失败结果
      results.push({
        channel: channelUsername,
        channelId: channelId,
        success: false,
        totalMessages: 0,
        newMessages: 0,
        forwardedMessages: 0,
        error: error.message
      });
    }
  }
  
  return results;
}

/**
 * 获取公开频道的消息（网页抓取）
 * @param {string} channelUsername - 频道用户名
 * @param {Object} config - 配置对象
 * @returns {Array} - 消息数组
 */
async function getChannelMessages(channelUsername, config) {
  const url = `https://t.me/s/${channelUsername}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.CHECK_TIMEOUT);
  
  try {
    // 发送 HTTP 请求
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"
      },
      redirect: "follow"
    });
    
    clearTimeout(timeoutId);
    
    // 检查响应状态
    if (!response.ok) {
      throw new Error(`HTTP 错误: ${response.status} ${response.statusText}`);
    }
    
    // 解析 HTML
    const html = await response.text();
    return parseMessages(html, channelUsername);
    
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === "AbortError") {
      throw new Error(`请求超时: ${url}`);
    }
    
    throw new Error(`获取频道消息失败: ${error.message}`);
  }
}

/**
 * 解析 HTML 提取消息（参考 Python 版本的 BeautifulSoup 解析）
 * @param {string} html - HTML 字符串
 * @param {string} channelUsername - 频道用户名
 * @returns {Array} - 消息数组
 */
function parseMessages(html, channelUsername) {
  const messages = [];
  
  console.log("开始解析消息...");
  
  // 步骤1：提取所有包含 data-post 属性的元素（参考 Python 版本的 find_all）
  const messageRegex = /<div[^>]+class="tgme_widget_message"[^>]+data-post="([^"]+)"[^>]*>([\s\S]*?)<\/div>/g;
  let match;
  let messageCount = 0;
  
  while ((match = messageRegex.exec(html)) !== null) {
    messageCount++;
    const messageId = match[1];
    const messageContent = match[2];
    
    try {
      let messageText = "";
      
      // 步骤2：提取文本消息（参考 Python 版本的 find(class_='tgme_widget_message_text')）
      const textRegex = /<div[^>]+class="tgme_widget_message_text"[^>]*>([\s\S]*?)<\/div>/;
      const textMatch = textRegex.exec(messageContent);
      
      if (textMatch) {
        // 移除 HTML 标签，提取纯文本
        messageText = textMatch[1].replace(/<[^>]+>/g, "").trim();
        // 处理 HTML 实体
        messageText = messageText
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'");
        
        // 清理空白字符
        messageText = messageText.replace(/\s+/g, " ").trim();
      } else {
        // 步骤3：检查媒体消息（参考 Python 版本的处理）
        if (messageContent.includes('tgme_widget_message_photo')) {
          messageText = "[图片消息]";
        } else if (messageContent.includes('tgme_widget_message_video')) {
          messageText = "[视频消息]";
        } else if (messageContent.includes('tgme_widget_message_audio')) {
          messageText = "[音频消息]";
        } else if (messageContent.includes('tgme_widget_message_document')) {
          messageText = "[文档消息]";
        } else {
          messageText = "[媒体消息]";
        }
      }
      
      // 只添加有内容的消息
      if (messageText && messageText.length > 0) {
        messages.push({
          id: messageId,
          text: messageText,
          channel: channelUsername,
          timestamp: Date.now()
        });
        console.log(`解析到消息 ${messageCount}: ${messageId} - ${messageText.substring(0, 30)}${messageText.length > 30 ? '...' : ''}`);
      } else {
        console.log(`跳过空消息 ${messageId}`);
      }
      
    } catch (parseError) {
      console.error(`解析消息 ${messageId} 时出错: ${parseError}`);
      continue;
    }
  }
  
  console.log(`解析完成，共找到 ${messages.length} 条有效消息（解析了 ${messageCount} 个消息容器）`);
  return messages;
}

/**
 * 过滤新消息（使用 KV 存储历史）
 * @param {Object} env - 环境变量对象
 * @param {string} channelUsername - 频道用户名
 * @param {Array} messages - 消息数组
 * @param {Object} config - 配置对象
 * @returns {Array} - 新消息数组
 */
async function filterNewMessages(env, channelUsername, messages, config) {
  const newMessages = [];
  const historyKey = `history_${channelUsername}`;
  
  try {
    // 1. 获取现有历史记录
    let history = new Set();
    const storedHistory = await env.MESSAGE_HISTORY.get(historyKey);
    
    if (storedHistory) {
      try {
        const historyArray = JSON.parse(storedHistory);
        history = new Set(historyArray);
      } catch (parseError) {
        console.error(`解析历史记录失败: ${parseError}`);
        history = new Set();
      }
    }
    
    console.log(`现有历史记录大小: ${history.size}`);
    
    // 2. 过滤新消息
    for (const msg of messages) {
      if (!history.has(msg.id)) {
        newMessages.push(msg);
        history.add(msg.id);
        console.log(`发现新消息: ${msg.id} - ${msg.text.substring(0, 30)}...`);
      }
    }
    
    // 3. 限制历史记录大小
    if (history.size > config.MESSAGE_HISTORY_SIZE) {
      const historyArray = Array.from(history);
      const recentHistory = historyArray.slice(-config.MESSAGE_HISTORY_SIZE);
      history = new Set(recentHistory);
      console.log(`历史记录已截断，保留最近 ${recentHistory.length} 条`);
    }
    
    // 4. 保存更新后的历史记录
    const historyArray = Array.from(history);
    await env.MESSAGE_HISTORY.put(historyKey, JSON.stringify(historyArray));
    console.log(`已保存频道 ${channelUsername} 的历史记录，共 ${historyArray.length} 条`);
    
  } catch (error) {
    console.error(`过滤新消息时出错: ${error}`);
    // 出错时返回所有消息（可能会重复，但保证不丢失）
    return messages;
  }
  
  return newMessages;
}

/**
 * 转发消息到目标频道
 * @param {Array} messages - 消息数组
 * @param {Object} config - 配置对象
 * @returns {number} - 成功转发的消息数量
 */
async function forwardMessages(messages, config) {
  let successCount = 0;
  
  for (const msg of messages) {
    console.log(`\n转发消息到目标频道:`);
    console.log(`来源: ${msg.channel}`);
    console.log(`内容: ${msg.text.substring(0, 100)}${msg.text.length > 100 ? '...' : ''}`);
    
    const success = await sendMessageToTarget(msg.text, config);
    if (success) {
      successCount++;
      console.log(`✓ 转发成功!`);
    } else {
      console.log(`✗ 转发失败!`);
    }
    
    // 避免 Telegram API 频率限制
    await new Promise(resolve => setTimeout(resolve, config.MESSAGE_SEND_DELAY));
  }
  
  return successCount;
}

/**
 * 发送消息到目标频道
 * @param {string} messageText - 消息文本
 * @param {Object} config - 配置对象
 * @returns {boolean} - 是否发送成功
 */
async function sendMessageToTarget(messageText, config) {
  const url = `https://api.telegram.org/bot${config.BOT_TOKEN}/sendMessage`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时
  
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        chat_id: config.TARGET_CHANNEL,
        text: messageText,
        parse_mode: "HTML",
        disable_web_page_preview: false
      })
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Telegram API 错误: ${response.status} - ${errorText}`);
      return false;
    }
    
    const result = await response.json();
    if (!result.ok) {
      console.error(`Telegram API 响应错误: ${result.description}`);
      return false;
    }
    
    return true;
    
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === "AbortError") {
      console.error(`发送消息超时`);
    } else {
      console.error(`发送消息失败: ${error.message}`);
    }
    
    return false;
  }
}

/**
 * 生成执行报告
 * @param {Array} results - 监控结果数组
 * @returns {Object} - 执行报告
 */
function generateReport(results) {
  const successCount = results.filter(r => r.success).length;
  const totalChannels = results.length;
  const totalNewMessages = results.reduce((sum, r) => sum + r.newMessages, 0);
  const totalForwardedMessages = results.reduce((sum, r) => sum + r.forwardedMessages, 0);
  
  console.log(`\n=== 监控服务执行完成 ===`);
  console.log(`总监控频道: ${totalChannels}`);
  console.log(`成功监控: ${successCount}`);
  console.log(`失败监控: ${totalChannels - successCount}`);
  console.log(`发现新消息: ${totalNewMessages}`);
  console.log(`成功转发: ${totalForwardedMessages}`);
  
  // 详细结果
  results.forEach(result => {
    if (result.success) {
      console.log(`频道 ${result.channel}: 成功 - 新消息 ${result.newMessages}，转发 ${result.forwardedMessages}`);
    } else {
      console.log(`频道 ${result.channel}: 失败 - ${result.error}`);
    }
  });
  
  return {
    status: "completed",
    timestamp: new Date().toISOString(),
    summary: {
      totalChannels,
      successCount,
      failureCount: totalChannels - successCount,
      totalNewMessages,
      totalForwardedMessages
    },
    details: results,
    message: "Telegram 频道监控任务执行完成"
  };
}

/**
 * 创建成功响应
 * @param {Object} data - 响应数据
 * @returns {Response} - HTTP 响应对象
 */
function createSuccessResponse(data) {
  return new Response(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store"
    }
  });
}

/**
 * 创建错误响应
 * @param {number} status - HTTP 状态码
 * @param {string} message - 错误消息
 * @returns {Response} - HTTP 响应对象
 */
function createErrorResponse(status, message) {
  const errorData = {
    status: "error",
    timestamp: new Date().toISOString(),
    error: message,
    statusCode: status
  };
  
  return new Response(JSON.stringify(errorData, null, 2), {
    status: status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store"
    }
  });
}

/**
 * 错误处理中间件
 * @param {Function} fn - 要执行的函数
 * @returns {Function} - 包装后的函数
 */
function errorHandler(fn) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      console.error(`未捕获的错误: ${error}`);
      return createErrorResponse(500, `服务器内部错误: ${error.message}`);
    }
  };
}

// 导出包装后的函数（可选，用于生产环境）
// export default errorHandler(onRequest);