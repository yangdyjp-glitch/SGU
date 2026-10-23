import { documentSummary } from '../public/document-status.js';

const omitted=['text','suggestions','projectDraft','previousManualDraft','previousAutoReview','analysis','autoReview','reviewerFeedback'];
const parse=row=>row?JSON.parse(row.data):null;
export async function readDocument(db,id){return parse(await db.prepare('SELECT data FROM documents WHERE id=?').get(id));}

// Project the existing summary inside the database. Polling must not transfer
// every PDF transcript and every rule draft just to show a processing badge.
export async function readDocumentSummaries(db){
 const sql=db.kind==='postgres'
  ? `SELECT (data::jsonb - ARRAY[${omitted.map(key=>`'${key}'`).join(',')}])::text AS data,
      length(data::jsonb->>'text') AS text_length, jsonb_typeof(data::jsonb->'autoReview') AS review_type,
      data::jsonb#>>'{autoReview,version}' AS review_version FROM documents`
  : `SELECT json_remove(data,${omitted.map(key=>`'$.${key}'`).join(',')}) AS data,
      length(json_extract(data,'$.text')) AS text_length, json_type(data,'$.autoReview') AS review_type,
      json_extract(data,'$.autoReview.version') AS review_version FROM documents`;
 return (await db.prepare(sql).all()).map(row=>{
  const value=parse(row);
  return documentSummary({...value,hasText:Boolean(row.text_length||value.hasText),hasReview:row.review_type==='object'||Boolean(value.hasReview),reviewVersion:row.review_version==null?(value.reviewVersion||0):Number(row.review_version)});
 });
}

export async function readRecoveryDocuments(db){
 const field=key=>db.kind==='postgres'?`data::jsonb#>>'{${key.split('.').join(',')}}'`:`json_extract(data,'$.${key}')`;
 const status=field('status'),validation=field('autoReview.validationVersion');
 const sql=`SELECT data FROM documents WHERE ${status} IN ('queued','parsing','extracting','needs_configuration')
  OR (${status}='review' AND COALESCE(CAST(${validation} AS TEXT),'0')<>'3')
  OR (${status}='error' AND COALESCE(CAST(${field('workflowVersion')} AS TEXT),'0') IN ('0',''))`;
 return (await db.prepare(sql).all()).map(parse);
}
