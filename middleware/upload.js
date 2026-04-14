const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const createUploader = (folder) => {
  const uploadDir = path.join(__dirname, '..', 'uploads', folder);
  ensureDir(uploadDir);

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, `${folder}-${uuidv4()}${path.extname(file.originalname || '').toLowerCase()}`),
  });

  return multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => file.mimetype?.startsWith('image/') ? cb(null, true) : cb(new Error('Only image files are allowed')),
  });
};

module.exports = { createUploader };
