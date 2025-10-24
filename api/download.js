const Y2Matez = require('./index');

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
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
    
    const { url, query, format = 'mp4', quality = 'auto' } = body;
    
    if (!url && !query) {
      return res.status(400).json({ error: 'URL or query required' });
    }

    const y2mate = new Y2Matez();
    
    if (url) {
      y2mate.useUrl(url);
    } else {
      y2mate.useQuery(query);
    }

    console.log('Download request:', { format, quality, url: url || query });
    const result = await y2mate.getInfo(format, quality);
    
    res.json({ 
      success: true, 
      data: result 
    });
    
  } catch (error) {
    console.error('Download error:', error.message);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      type: 'download_error'
    });
  }
};
