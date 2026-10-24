export default function handler(req, res) {
  const buffer = Buffer.alloc(20 * 1024 * 1024); // 20MB
  res.status(200).send(buffer);
}
