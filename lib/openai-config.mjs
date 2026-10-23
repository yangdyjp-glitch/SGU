import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { db, dataDir } from './store.mjs';

export const DEFAULT_DOCUMENT_MODEL = 'gpt-6.1-sol';
const configPath = join(dataDir, 'openai.json');
export async function openAIConfig() {
  const shared=db.kind==='postgres'?await db.prepare("SELECT value FROM settings WHERE key='openai'").get():null;
  let saved=shared?JSON.parse(shared.value):{};
  if(!shared)try { saved = JSON.parse(readFileSync(configPath, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw new Error('OpenAI配置无法读取，请重新保存配置'); }
  return { apiKey: saved.apiKey || process.env.OPENAI_API_KEY || '', model: saved.model || process.env.OPENAI_MODEL || DEFAULT_DOCUMENT_MODEL };
}
export async function openAIStatus() {
  const config = await openAIConfig();
  return { configured: Boolean(config.apiKey), model: config.model };
}
export async function saveOpenAIConfig(body) {
  const previous = await openAIConfig();
  const apiKey = typeof body.apiKey === 'string' && body.apiKey.trim() ? body.apiKey.trim() : previous.apiKey;
  const model = typeof body.model === 'string' && body.model.trim() ? body.model.trim() : previous.model;
  if (!apiKey || apiKey.length < 16 || apiKey.length > 1000 || /\s/.test(apiKey)) throw Object.assign(new Error('请填写有效的OpenAI API密钥'), { status: 400 });
  if (!/^[a-zA-Z0-9._:-]{1,100}$/.test(model)) throw Object.assign(new Error('模型名称格式不正确'), { status: 400 });
  if(db.kind==='postgres')await db.prepare("INSERT INTO settings VALUES('openai',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify({apiKey,model}));
  else{writeFileSync(configPath + '.tmp', JSON.stringify({ apiKey, model }), { mode: 0o600 });renameSync(configPath + '.tmp', configPath);}
  return openAIStatus();
}
export async function checkOpenAIConnection() {
  const config = await openAIConfig();
  if (!config.apiKey) throw Object.assign(new Error('请先保存OpenAI API密钥'), { status: 400 });
  let response;
  try { response = await fetch('https://api.openai.com/v1/models/' + encodeURIComponent(config.model), { headers: { Authorization: 'Bearer ' + config.apiKey }, signal: AbortSignal.timeout(20000) }); }
  catch { throw Object.assign(new Error('暂时无法连接OpenAI，请检查服务器网络后重试'), { status: 502 }); }
  if (!response.ok) throw Object.assign(new Error(response.status === 401 ? 'OpenAI密钥未通过验证，请检查后重新保存' : response.status === 404 || response.status === 403 ? '当前账号无法使用此模型，请核对模型名称和账号权限' : 'OpenAI暂时无法响应，请稍后重试'), { status: 400 });
  return { ...await openAIStatus(), connected: true };
}
