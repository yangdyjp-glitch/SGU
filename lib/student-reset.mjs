import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export const studentResetKey = 'student-reset-school-overview-20261021';

// Explicit maintenance operation, never called by the normal server startup.
// The one-time marker prevents a repeated update from clearing new students.
export function resetStudentsOnce(db, dataDir) {
  const previous = db.prepare('SELECT value FROM meta WHERE key=?').get(studentResetKey);
  if (previous) return { ...JSON.parse(previous.value), skipped: true };
  const backupDir = join(dataDir, 'backups');
  mkdirSync(backupDir, { recursive: true });
  const backupPath = join(backupDir, `before-student-clear-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}.db`);
  // VACUUM INTO produces a complete SQLite snapshot, including committed WAL data.
  db.prepare('VACUUM INTO ?').run(backupPath);
  db.exec('BEGIN IMMEDIATE');
  try {
    const repeated = db.prepare('SELECT value FROM meta WHERE key=?').get(studentResetKey);
    if (repeated) { db.exec('COMMIT'); return { ...JSON.parse(repeated.value), skipped: true }; }
    const students = Number(db.prepare('SELECT count(*) AS n FROM students').get().n);
    const matches = Number(db.prepare('SELECT count(*) AS n FROM matches').get().n);
    db.exec("DELETE FROM matches; DELETE FROM students; DELETE FROM events WHERE kind IN ('student','match');");
    const result = { students, matches, backupPath, completedAt: new Date().toISOString() };
    db.prepare('INSERT INTO meta(key,value) VALUES(?,?)').run(studentResetKey, JSON.stringify(result));
    db.prepare('INSERT INTO events VALUES(?,?,?,?,?,?)').run(randomUUID(), 'maintenance', '学生档案', '本机维护', JSON.stringify({ action: '按用户要求清空全部学生及匹配记录', students, matches }), result.completedAt);
    db.prepare("INSERT INTO meta VALUES('revision','1') ON CONFLICT(key) DO UPDATE SET value=CAST(CAST(value AS INTEGER)+1 AS TEXT)").run();
    db.exec('COMMIT');
    return { ...result, skipped: false };
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}
