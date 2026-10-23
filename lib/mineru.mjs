import { spawn } from 'node:child_process';
import { delimiter } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const failure = (message, code) => Object.assign(new Error(message), { code });

export function runMineru(args, { json = true, timeoutMs = 30000 } = {}) {
  if (!process.env.MINERU_BIN) throw failure('本机MinerU路径尚未配置。请在.env中设置MINERU_BIN和MINERU_HOME，重启后重试。', 'not_configured');
  const env = { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' };
  const pathKey = Object.keys(env).find(key => key.toLowerCase() === 'path') || 'PATH';
  if (env.MINERU_BIN_DIR) env[pathKey] = env.MINERU_BIN_DIR + delimiter + (env[pathKey] || '');
  return new Promise((resolve, reject) => {
    const child = spawn(env.MINERU_BIN, args, { env, windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', bytes = 0, settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      error ? reject(error) : resolve(result);
    };
    const timer = setTimeout(() => {
      child.kill();
      finish(failure('本机解析服务响应超时，请稍后重试；原始文件已保留。', 'command_timeout'));
    }, timeoutMs);
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      bytes += Buffer.byteLength(chunk);
      if (bytes > 12 * 1024 * 1024) {
        child.kill();
        finish(failure('提取内容超过当前处理上限，请拆分文件后上传。', 'output_limit'));
      } else stdout += chunk;
    });
    child.stderr.resume();
    child.once('error', error => finish(failure(error.code === 'ENOENT' ? '未找到配置的MinerU程序，请检查MINERU_BIN路径。' : '无法启动本机MinerU程序，请检查安装与运行权限。', error.code)));
    // Read after the streams close; exit can fire before the final JSON chunk arrives.
    child.once('close', code => {
      if (settled) return;
      if (!json) return code === 0 ? finish(null, stdout.trim()) : finish(failure('本机解析服务启动失败，请检查MinerU服务日志后重试。', 'start_failed'));
      let result;
      try { result = JSON.parse(stdout); } catch { return finish(failure('MinerU没有返回有效的结构化结果，请检查本机服务。', 'invalid_response')); }
      if (result?.error) return finish(failure(`MinerU ${result.error.code}：${result.error.user_action || result.error.message || '请检查解析服务。'}`, result.error.code));
      code === 0 ? finish(null, result) : finish(failure(`MinerU解析未完成（退出码${code}），请检查本机服务。`, 'command_failed'));
    });
  });
}

export function createMineruClient({ run = runMineru, pause = delay, clock = Date.now } = {}) {
  async function ensureReady() {
    const deadline = clock() + 180000;
    let started = false;
    while (clock() < deadline) {
      let status;
      try { status = await run(['server', 'status', '--json']); }
      catch (error) {
        if (error.code !== 'server_not_running') throw error;
        status = { running: false };
      }
      if (status?.running === false && !started) {
        // Start is idempotent; never stop or restart a service used by other projects.
        await run(['server', 'start'], { json: false, timeoutMs: 90000 });
        started = true;
      } else if (status?.running === true) {
        const local = status.parse_server?.local;
        if (local?.healthy && local.supported_tiers?.includes('standard')) return;
        if (local?.mode === 'disabled') throw failure('MinerU已运行，但本机PDF解析引擎尚未启用，请检查本机解析配置。', 'local_engine_disabled');
        if (local?.healthy) throw failure('本机解析引擎尚不支持标准解析，请检查已安装的模型与解析配置。', 'quality_tier_unavailable');
      } else if (status?.running !== false) {
        throw failure('无法确认MinerU服务状态，请检查本机服务。', 'invalid_status');
      }
      await pause(2000);
    }
    throw failure('本机解析引擎未能在3分钟内就绪，请检查MinerU服务日志后重试；原始文件已保留。', 'startup_timeout');
  }

  async function parse(file) {
    await ensureReady();
    const deadline = clock() + 600000;
    let recovered = false;
    while (clock() < deadline) {
      const seconds = Math.max(1, Math.min(180, Math.floor((deadline - clock()) / 1000)));
      try {
        return await run(['parse', file, '--pages', 'all', '--tier', 'standard', '--wait', String(seconds), '--limit', '1000000', '--json'], { timeoutMs: (seconds + 30) * 1000 });
      } catch (error) {
        if (error.code === 'parse_wait_timeout') continue; // Continue the existing queued job; never force a new parse.
        if (error.code !== 'server_not_running' || recovered) throw error;
        recovered = true;
        await ensureReady();
      }
    }
    throw failure('本机解析已等待10分钟。任务可能仍在后台处理，请稍后重试以读取结果；原始文件已保留。', 'parse_timeout');
  }
  return { ensureReady, parse };
}

export const localMineru = createMineruClient();
