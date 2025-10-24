const axios = require('axios');

const config = {
    headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "X-Requested-With": "XMLHttpRequest",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
    }
};

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const { url, query } = body;

        if (!url && !query) {
            return res.status(400).json({ error: 'URL or query required' });
        }

        const videoUrl = url || query;
        const analyzeUrl = "https://www.y2mate.com/mates/analyzeV2/ajax";
        
        const analyzeData = new URLSearchParams();
        analyzeData.append('k_query', videoUrl);
        analyzeData.append('k_page', 'home');
        analyzeData.append('hl', 'en');
        analyzeData.append('q_auto', '0');

        const response = await axios.post(analyzeUrl, analyzeData, config);
        
        if (response.data.status !== 'ok') {
            throw new Error('Analyze failed');
        }

        res.json({
            success: true,
            data: {
                links: response.data.links,
                related: response.data.related,
                detail: {
                    title: response.data.title,
                    videoId: response.data.vid,
                    thumbnail: `https://i.ytimg.com/vi/${response.data.vid}/hqdefault.jpg`,
                    author: { name: response.data.a },
                    timestamp: response.data.t
                }
            }
        });

    } catch (error) {
        console.error('Analyze error:', error.message);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
};
