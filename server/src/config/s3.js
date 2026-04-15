const { S3Client, PutObjectCommand, PutBucketPolicyCommand } = require('@aws-sdk/client-s3');

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
    ACL: 'public-read',
  }));
  return `${PUBLIC_URL}/${key}`;
}

/**
 * Devuelve la URL pública de un archivo subido con multer-s3.
 * req.file.location puede quedar undefined con endpoints custom (Railway),
 * en ese caso la construimos desde el key.
 */
function fileLocation(file) {
  return file.location || `${PUBLIC_URL}/${file.key}`;
}

/**
 * Configura el bucket como público (lectura) al iniciar el servidor.
 * Railway Object Storage es privado por defecto.
 */
async function makeBucketPublic() {
  const policy = JSON.stringify({
    Version: '2012-10-17',
    Statement: [{
      Sid: 'PublicRead',
      Effect: 'Allow',
      Principal: '*',
      Action: ['s3:GetObject'],
      Resource: [`arn:aws:s3:::${BUCKET}/*`]
    }]
  });
  try {
    await s3.send(new PutBucketPolicyCommand({ Bucket: BUCKET, Policy: policy }));
    console.log('✓ Bucket S3 configurado como público');
  } catch (err) {
    console.warn('⚠ No se pudo configurar bucket público:', err.message);
  }
}

module.exports = { s3, BUCKET, PUBLIC_URL, uploadBuffer, fileLocation, makeBucketPublic };
