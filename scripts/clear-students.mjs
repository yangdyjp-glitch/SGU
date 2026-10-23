if (!process.argv.includes('--confirm-clear-all')) {
  console.error('Explicit confirmation required: node --env-file-if-exists=.env scripts/clear-students.mjs --confirm-clear-all');
  process.exitCode = 1;
} else {
  if(process.env.DATABASE_URL)throw new Error('历史清理工具不适用于共享数据库；已保留全部档案');
  const { db, dataDir } = await import('../lib/store.mjs');
  const { resetStudentsOnce } = await import('../lib/student-reset.mjs');
  try {
    const result = resetStudentsOnce(db.raw, dataDir);
    console.log(result.skipped ? 'Student cleanup already applied. New student records were preserved.' : `Cleared ${result.students} student records and ${result.matches} match snapshots.`);
    console.log(`Database backup: ${result.backupPath}`);
  } finally { await db.close(); }
}
