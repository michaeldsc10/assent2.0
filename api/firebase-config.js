export default function handler(req, res) {
  // Apenas GET permitido
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Lê as keys do ambiente da Vercel — nunca expostas ao browser
  const config = {
    apiKey:            process.env.VITE_FIREBASE_API_KEY,
    authDomain:        process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId:         process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket:     process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId:             process.env.VITE_FIREBASE_APP_ID,
    measurementId:     process.env.VITE_FIREBASE_MEASUREMENT_ID,
  };

  // Garante que as variáveis essenciais existem
  if (!config.apiKey || !config.projectId) {
    return res.status(500).json({ error: 'Firebase env vars não configuradas no servidor.' });
  }

  // Cache curto: evita chamadas repetidas sem expor por tempo demais
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.status(200).json(config);
}
