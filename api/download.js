const axios = require('axios');

// Config headers
const config = {
    headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
        "X-Requested-With": "XMLHttpRequest",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "en-US,en;q=0.9",
        "Origin": "https://www.y2mate.com",
        "Referer": "https://www.y2mate.com/",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin"
    }
};

module.exports = async (req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        console.log('Received request');
        
        let body;
        try {
            body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        } catch (e) {
            console.error('JSON parse error:', e);
            return res.status(400).json({ error: 'Invalid JSON: ' + e.message });
        }
        
        const { url, query, format = 'mp4', quality = 'auto' } = body;
        
        console.log('Request data:', { url, query, format, quality });

        if (!url && !query) {
            return res.status(400).json({ error: 'URL or query required' });
        }

        // Step 1: Analyze video
        const analyzeUrl = "https://www.y2mate.com/mates/analyzeV2/ajax";
        const videoUrl = url || `https://www.youtube.com/watch?v=${await getVideoIdFromQuery(query)}`;
        
        console.log('Analyzing URL:', videoUrl);

        const analyzeData = new URLSearchParams();
        analyzeData.append('k_query', videoUrl);
        analyzeData.append('k_page', 'home');
        analyzeData.append('hl', 'en');
        analyzeData.append('q_auto', '0');

        const analyzeResponse = await axios.post(analyzeUrl, analyzeData, config);
        
        console.log('Analyze response status:', analyzeResponse.data.status);
        
        if (analyzeResponse.data.status !== 'ok') {
            throw new Error('Analyze failed: ' + (analyzeResponse.data.message || 'Unknown error'));
        }

        const analyzeInfo = analyzeResponse.data;
        
        // Step 2: Convert video
        const convertUrl = "https://www.y2mate.com/mates/convertV2/index";
        
        // Find the requested format and quality
        const formatData = analyzeInfo.links[format];
        if (!formatData) {
            throw new Error(`Format ${format} not available`);
        }

        let selectedQuality = quality;
        if (quality === 'auto') {
            // Auto select best quality
            const qualities = Object.values(formatData).map(item => item.q);
            selectedQuality = format === 'mp4' ? 
                (qualities.includes('720p') ? '720p' : qualities[0]) :
                (qualities.includes('128kbps') ? '128kbps' : qualities[0]);
        }

        const qualityData = Object.values(formatData).find(item => item.q === selectedQuality);
        if (!qualityData) {
            throw new Error(`Quality ${selectedQuality} not available for format ${format}`);
        }

        const convertData = new URLSearchParams();
        convertData.append('vid', analyzeInfo.vid);
        convertData.append('k', qualityData.k);

        const convertResponse = await axios.post(convertUrl, convertData, config);
        
        console.log('Convert response status:', convertResponse.data.status);
        
        if (convertResponse.data.status !== 'ok') {
            throw new Error('Convert failed: ' + (convertResponse.data.message || 'Unknown error'));
        }

        const result = {
            success: true,
            data: {
                detail: {
                    title: analyzeInfo.title,
                    thumbnail: `https://i.ytimg.com/vi/${analyzeInfo.vid}/hqdefault.jpg`,
                    videoId: analyzeInfo.vid,
                    views: 0,
                    timestamp: analyzeInfo.t,
                    ago: '',
                    author: { name: analyzeInfo.a }
                },
                convertInfo: {
                    ftype: format,
                    fquality: selectedQuality,
                    dlink: convertResponse.data.dlink,
                    size: qualityData.size,
                    q: selectedQuality,
                    q_text: qualityData.q_text
                }
            }
        };

        console.log('Success! Download link:', convertResponse.data.dlink);
        res.json(result);

    } catch (error) {
        console.error('❌ API Error:', error.message);
        console.error('Stack:', error.stack);
        
        res.status(500).json({ 
            success: false, 
            error: error.message,
            type: 'server_error'
        });
    }
};

// Helper function to get video ID from search query
async function getVideoIdFromQuery(query) {
    // Simple implementation - in real case you'd use YouTube search API
    // For now, we'll assume the query is actually a video ID
    return query;
}
