const axios = require('axios');

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
        const videoId = extractVideoId(videoUrl);
        
        if (!videoId) {
            throw new Error('Invalid YouTube URL');
        }

        // Get basic video info
        const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
        const response = await axios.get(oembedUrl);
        const videoInfo = response.data;

        res.json({
            success: true,
            data: {
                links: {
                    mp4: {
                        '360p': { q: '360p', size: '~50MB' },
                        '720p': { q: '720p', size: '~120MB' }
                    },
                    mp3: {
                        '128kbps': { q: '128kbps', size: '~5MB' }
                    }
                },
                detail: {
                    title: videoInfo.title,
                    thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                    videoId: videoId,
                    author: { name: videoInfo.author_name },
                    timestamp: 'Unknown',
                    views: 0,
                    ago: ''
                }
            }
        });

    } catch (error) {
        console.error('Analyze error:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Could not analyze video' 
        });
    }
};

function extractVideoId(url) {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}
