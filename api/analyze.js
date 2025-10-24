const Y2Matez = require('../index');

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let body;
    try {
      body = JSON.parse(req.body);
    } catch (e) {
      body = req.body;
    }
    
    const { url, query } = body;
    const y2mate = new Y2Matez();
    
    if (url) {
      y2mate.useUrl(url);
    } else if (query) {
      y2mate.useQuery(query);
    } else {
      return res.status(400).json({ error: 'URL or query required' });
    }

    const result = await y2mate.analyze();
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Analyze error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
