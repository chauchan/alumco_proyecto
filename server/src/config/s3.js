const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const s3 = new S3Client({
  region: process.env.AWS_DEFAULT_REGION || 'auto',
  endpoint: process.env.AWS_ENDPOINT_URL,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

const BUCKET = process.env.AWS_S3_BUCKET_NAME;
// URL pública: endpoint + nombre del bucket
const PUBLIC_URL = `${process.env.AWS_ENDPOINT_URL}/${process.env.AWS_S3_BUCKET_NAME}`;

/**
 * Sube un Buffer a S3 y devuelve la URL pública.
 * @param {Buffer} buffer
 * @param {string} key  — ruta dentro del bucket, ej: "certs/cert_5.pdf"
 * @param {string} contentType — MIME type
 */
async function uploadBuffer(buffer, key, contentType) {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));
  return `${PUBLIC_URL}/${key}`;
}

module.exports = { s3, BUCKET, PUBLIC_URL, uploadBuffer };
