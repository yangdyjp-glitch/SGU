// One document read owns the dialog until it completes, is replaced or is closed.
export function createDocumentLoader({ read, latest, apply, start, success, failure, timeoutMs = 30000 }) {
  let active = null;
  function cancel() {
    const previous = active;
    active = null;
    previous?.controller.abort();
  }
  function open(id, { background = false } = {}) {
    if (active) {
      // Status polling must not supersede a user's click or start another read.
      if (background || active.id === id && !active.background) return active.promise;
      cancel();
    }
    start(id, { background });
    const task = { id, background, controller: new AbortController(), timedOut: false };
    active = task;
    const timer = setTimeout(() => { task.timedOut = true; task.controller.abort(); }, timeoutMs);
    task.promise = (async () => {
      try {
        for (let attempt = 0; attempt < 2; attempt++) {
          const incoming = await read(id, task.controller.signal);
          if (active !== task) return;
          if ((latest(id)?.statusVersion || 0) > (incoming.statusVersion || 0)) {
            if (!attempt) continue;
            throw new Error('资料状态刚有更新，请重试加载最新内容。');
          }
          apply(incoming);
          success(incoming);
          return;
        }
      } catch (error) {
        if (active === task) failure(id, task.timedOut ? new Error('加载超时，请重试。已上传的资料和整理结果仍然保留。') : error);
      } finally {
        clearTimeout(timer);
        if (active === task) active = null;
      }
    })();
    return task.promise;
  }
  return { open, cancel };
}
